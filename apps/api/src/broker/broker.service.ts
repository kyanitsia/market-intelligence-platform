import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';

import { MARKET_DLX, MARKET_EXCHANGE, WORK_QUEUES } from './broker.constants';
import { failureAction, readAttempt } from './broker.delivery';

type MessageHandler = (body: unknown) => Promise<void>;

const RECONNECT_MS = 2_000;
const LAG_LOG_MS = 60_000;

@Injectable()
export class BrokerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrokerService.name);
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: ConfirmChannel | null = null;
  private opening: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lagTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private readonly handlers = new Map<string, MessageHandler>();
  private readonly attached = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    void this.open();
    this.lagTimer = setInterval(() => {
      void this.logLag();
    }, LAG_LOG_MS);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.lagTimer) {
      clearInterval(this.lagTimer);
    }

    await this.connection?.close().catch(() => undefined);
    this.connection = null;
    this.channel = null;
  }

  consume(queue: string, handler: MessageHandler): void {
    this.handlers.set(queue, handler);

    if (this.channel) {
      void this.attach(this.channel, queue, handler);
    }
  }

  async publish(routingKey: string, body: unknown): Promise<void> {
    const channel = await this.waitForChannel();
    await this.publishTo(channel, routingKey, body, 1);
  }

  private open(): Promise<void> {
    if (this.stopped || this.channel) {
      return Promise.resolve();
    }

    if (this.opening) {
      return this.opening;
    }

    this.opening = this.connectOnce().finally(() => {
      this.opening = null;
    });

    return this.opening;
  }

  private async connectOnce(): Promise<void> {
    const url =
      this.config.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';

    try {
      const connection = await amqp.connect(url);
      connection.on('error', (error: unknown) => {
        this.logger.warn(`Message broker connection error: ${text(error)}`);
      });
      connection.on('close', () => {
        this.connection = null;
        this.channel = null;
        this.attached.clear();
        this.scheduleReconnect();
      });

      const channel = await connection.createConfirmChannel();
      channel.on('error', (error: unknown) => {
        this.logger.warn(`Message broker channel error: ${text(error)}`);
      });
      await this.assertTopology(channel);
      await channel.prefetch(1);
      this.connection = connection;
      this.channel = channel;

      try {
        await this.attachAll(channel);
      } catch (error) {
        this.connection = null;
        this.channel = null;
        this.attached.clear();
        await connection.close().catch(() => undefined);
        throw error;
      }

      this.logger.log('Message broker connected');
    } catch (error: unknown) {
      this.logger.warn(
        `Message broker unavailable: ${text(error)}. Retrying in ${RECONNECT_MS}ms`,
      );
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.open();
    }, RECONNECT_MS);
  }

  private async assertTopology(channel: ConfirmChannel): Promise<void> {
    await channel.assertExchange(MARKET_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(MARKET_DLX, 'topic', { durable: true });

    for (const queue of WORK_QUEUES) {
      const deadLetter = `${queue.name}.dlq`;

      await channel.assertQueue(deadLetter, { durable: true });
      await channel.bindQueue(deadLetter, MARKET_DLX, deadLetter);
      await channel.assertQueue(queue.name, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': MARKET_DLX,
          'x-dead-letter-routing-key': deadLetter,
        },
      });
      await channel.bindQueue(queue.name, MARKET_EXCHANGE, queue.routingKey);
    }
  }

  private async attachAll(channel: ConfirmChannel): Promise<void> {
    for (const [queue, handler] of this.handlers) {
      await this.attach(channel, queue, handler);
    }
  }

  private async attach(
    channel: ConfirmChannel,
    queue: string,
    handler: MessageHandler,
  ): Promise<void> {
    if (this.attached.has(queue)) {
      return;
    }

    this.attached.add(queue);

    try {
      await channel.consume(queue, (message) => {
        if (!message) {
          return;
        }

        void this.deliver(channel, queue, message, handler);
      });
    } catch (error) {
      this.attached.delete(queue);
      throw error;
    }
  }

  private async deliver(
    channel: ConfirmChannel,
    queue: string,
    message: ConsumeMessage,
    handler: MessageHandler,
  ): Promise<void> {
    const attempt = readAttempt(message.properties.headers);
    let body: unknown;

    try {
      body = JSON.parse(message.content.toString());
    } catch {
      this.deadLetter(channel, message, queue, attempt, 'invalid json');
      return;
    }

    try {
      await handler(body);
      channel.ack(message);
    } catch (error: unknown) {
      const reason = text(error);

      if (failureAction(attempt) === 'dead-letter') {
        this.deadLetter(channel, message, queue, attempt, reason);
        return;
      }

      try {
        await this.sendToQueue(channel, queue, message.content, attempt + 1);
        channel.ack(message);
        this.logger.warn(`Retrying ${queue} attempt ${attempt + 1}: ${reason}`);
      } catch (republishError: unknown) {
        channel.nack(message, false, true);
        this.logger.warn(
          `Requeueing ${queue} after retry publish failed: ${text(republishError)}`,
        );
      }
    }
  }

  private deadLetter(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    queue: string,
    attempt: number,
    reason: string,
  ): void {
    channel.nack(message, false, false);
    this.logger.error(
      `Dead-lettered ${queue} after ${attempt} attempts: ${reason}`,
    );
  }

  private async waitForChannel(): Promise<ConfirmChannel> {
    const started = Date.now();

    while (!this.channel) {
      if (Date.now() - started > 10_000) {
        throw new Error('Message broker is unavailable');
      }

      await this.open();

      if (!this.channel) {
        await delay(200);
      }
    }

    return this.channel;
  }

  private publishTo(
    channel: ConfirmChannel,
    routingKey: string,
    body: unknown,
    attempt: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      channel.publish(
        MARKET_EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(body)),
        {
          persistent: true,
          contentType: 'application/json',
          headers: { 'x-attempts': attempt },
        },
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  private sendToQueue(
    channel: ConfirmChannel,
    queue: string,
    content: Buffer,
    attempt: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      channel.sendToQueue(
        queue,
        content,
        {
          persistent: true,
          contentType: 'application/json',
          headers: { 'x-attempts': attempt },
        },
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  private async logLag(): Promise<void> {
    if (!this.channel) {
      return;
    }

    for (const queue of WORK_QUEUES) {
      try {
        const status = await this.channel.checkQueue(queue.name);

        if (status.messageCount > 0) {
          this.logger.warn(`Queue ${queue.name} lag ${status.messageCount}`);
        }
      } catch (error: unknown) {
        this.logger.warn(
          `Queue lag check failed for ${queue.name}: ${text(error)}`,
        );
      }
    }
  }
}

function text(error: unknown): string {
  return error instanceof Error ? error.message : 'request failed';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
