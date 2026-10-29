import {
  applyFifoSell,
  InsufficientQuantityError,
  remainingLotsFromLedger,
} from './fifo';

describe('FIFO lot reconstruction', () => {
  it('realizes PnL from oldest BUY lots first', () => {
    const lots = remainingLotsFromLedger([
      { type: 'BUY', quantity: '10', price: '10' },
      { type: 'BUY', quantity: '5', price: '20' },
    ]);

    const sold = applyFifoSell(lots, '12', '30');

    expect(sold.realizedPnl).toBe('220');
    expect(sold.remainingQuantity).toBe('3');
    expect(sold.remainingAvgCostBasis).toBe('20');
  });

  it('reconstructs remaining lots from prior SELL rows instead of a stored lot field', () => {
    const lots = remainingLotsFromLedger([
      { type: 'BUY', quantity: '10', price: '10' },
      { type: 'BUY', quantity: '5', price: '20' },
      { type: 'SELL', quantity: '12', price: '30' },
    ]);

    expect(lots).toEqual([{ quantity: '3', price: '20' }]);

    const sold = applyFifoSell(lots, '3', '25');
    expect(sold.realizedPnl).toBe('15');
    expect(sold.remainingQuantity).toBe('0');
    expect(sold.remainingAvgCostBasis).toBe('0');
  });

  it('rejects a sell larger than remaining lots', () => {
    const lots = remainingLotsFromLedger([
      { type: 'BUY', quantity: '2', price: '10' },
    ]);

    expect(() => applyFifoSell(lots, '3', '12')).toThrow(
      InsufficientQuantityError,
    );
  });
});
