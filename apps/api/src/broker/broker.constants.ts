export const MARKET_EXCHANGE = 'market';
export const MARKET_DLX = 'market.dlx';

export const PRICE_UPDATES_ROUTING_KEY = 'price.updates';
export const NOTIFICATIONS_ROUTING_KEY = 'notifications';

export const PRICE_UPDATES_QUEUE = 'price.updates';
export const PRICE_ALERTS_QUEUE = 'price.updates.alerts';
export const NOTIFICATIONS_QUEUE = 'notifications';

export const WORK_QUEUES = [
  { name: PRICE_UPDATES_QUEUE, routingKey: PRICE_UPDATES_ROUTING_KEY },
  { name: PRICE_ALERTS_QUEUE, routingKey: PRICE_UPDATES_ROUTING_KEY },
  { name: NOTIFICATIONS_QUEUE, routingKey: NOTIFICATIONS_ROUTING_KEY },
] as const;
