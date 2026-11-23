import { failureAction, readAttempt } from './broker.delivery';

describe('broker delivery', () => {
  it('reads the attempt header and defaults to the first delivery', () => {
    expect(readAttempt(undefined)).toBe(1);
    expect(readAttempt({ 'x-attempts': 3 })).toBe(3);
    expect(readAttempt({ 'x-attempts': '2' })).toBe(2);
    expect(readAttempt({ 'x-attempts': 0 })).toBe(1);
  });

  it('dead-letters only after the attempt cap', () => {
    expect(failureAction(1)).toBe('retry');
    expect(failureAction(4)).toBe('retry');
    expect(failureAction(5)).toBe('dead-letter');
  });
});
