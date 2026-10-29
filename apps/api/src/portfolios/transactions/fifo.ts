import {
  addDecimal,
  cmpDecimal,
  divDecimal,
  isZeroDecimalString,
  mulDecimal,
  subDecimal,
} from '../../common/decimal-math';

export type LedgerEntryType = 'BUY' | 'SELL';

export type LedgerEntry = {
  type: LedgerEntryType;
  quantity: string;
  price: string;
  occurredAt?: Date;
};

export type FifoLot = {
  quantity: string;
  price: string;
  occurredAt?: Date;
};

export type FifoSellResult = {
  realizedPnl: string;
  remainingQuantity: string;
  remainingAvgCostBasis: string;
  remainingLots: FifoLot[];
};

export class InsufficientQuantityError extends Error {
  constructor() {
    super('Sell quantity exceeds remaining FIFO lots');
    this.name = 'InsufficientQuantityError';
  }
}

/**
 * §10 FIFO — lots are reconstructed from the append-only BUY ledger.
 * Prior SELL rows consume those lots in acquisition order; remaining lots
 * are not stored as a mutable field.
 */
export function remainingLotsFromLedger(entries: LedgerEntry[]): FifoLot[] {
  const lots: FifoLot[] = [];

  for (const entry of entries) {
    if (entry.type === 'BUY') {
      lots.push({
        quantity: entry.quantity,
        price: entry.price,
        ...(entry.occurredAt ? { occurredAt: entry.occurredAt } : {}),
      });
      continue;
    }

    consumeLots(lots, entry.quantity);
  }

  return lots.filter((lot) => !isZeroDecimalString(lot.quantity));
}

export function applyFifoSell(
  lots: FifoLot[],
  sellQuantity: string,
  sellPrice: string,
): FifoSellResult {
  const remaining = lots.map((lot) => ({ ...lot }));
  const realizedPnl = consumeLots(remaining, sellQuantity, sellPrice);
  const leftover = remaining.filter(
    (lot) => !isZeroDecimalString(lot.quantity),
  );
  const remainingQuantity = leftover.reduce(
    (sum, lot) => addDecimal(sum, lot.quantity),
    '0',
  );
  const remainingCost = leftover.reduce(
    (sum, lot) => addDecimal(sum, mulDecimal(lot.quantity, lot.price)),
    '0',
  );

  return {
    realizedPnl,
    remainingQuantity,
    remainingAvgCostBasis: isZeroDecimalString(remainingQuantity)
      ? '0'
      : (divDecimal(remainingCost, remainingQuantity) ?? '0'),
    remainingLots: leftover,
  };
}

function consumeLots(
  lots: FifoLot[],
  quantity: string,
  sellPrice?: string,
): string {
  let toSell = quantity;
  let realizedPnl = '0';

  for (const lot of lots) {
    if (isZeroDecimalString(toSell)) {
      break;
    }

    if (isZeroDecimalString(lot.quantity)) {
      continue;
    }

    const taken = cmpDecimal(lot.quantity, toSell) <= 0 ? lot.quantity : toSell;

    if (sellPrice !== undefined) {
      realizedPnl = addDecimal(
        realizedPnl,
        mulDecimal(taken, subDecimal(sellPrice, lot.price)),
      );
    }

    lot.quantity = subDecimal(lot.quantity, taken);
    toSell = subDecimal(toSell, taken);
  }

  if (!isZeroDecimalString(toSell)) {
    throw new InsufficientQuantityError();
  }

  return realizedPnl;
}
