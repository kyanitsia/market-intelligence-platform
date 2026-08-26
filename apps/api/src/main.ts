import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser = require('cookie-parser');

import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = Number(configService.get<string | number>('PORT') ?? 3000);

  app.setGlobalPrefix('api/v1');

  app.use(helmet());
  app.use(cookieParser());

  const corsOrigin =
    configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  logger.log(`Application listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
