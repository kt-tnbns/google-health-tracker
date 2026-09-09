import { checkAndRecord, resetThrottle } from './admin.guard';

describe('admin throttle', () => {
  beforeEach(resetThrottle);
  it('locks an IP after 5 wrong tokens within the window, and stays locked even for a correct one', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) expect(checkAndRecord('1.2.3.4', false, t0 + i)).toBe('unauthorized');
    expect(checkAndRecord('1.2.3.4', false, t0 + 5)).toBe('locked');
    expect(checkAndRecord('1.2.3.4', true, t0 + 6)).toBe('locked');
    expect(checkAndRecord('1.2.3.4', true, t0 + 5 + 15 * 60_000 + 1)).toBe('ok');   // lock expired
  });
  it('a correct token clears the counter; other IPs are independent', () => {
    checkAndRecord('a', false); checkAndRecord('a', false);
    expect(checkAndRecord('a', true)).toBe('ok');
    for (let i = 0; i < 3; i++) checkAndRecord('a', false);
    expect(checkAndRecord('a', false)).toBe('unauthorized');   // counter restarted after the success → this is only the 4th fail
    expect(checkAndRecord('a', false)).toBe('locked');
    expect(checkAndRecord('b', false)).toBe('unauthorized');
  });
  it('old failures fall out of the window', () => {
    const t0 = 0;
    for (let i = 0; i < 4; i++) checkAndRecord('c', false, t0 + i);
    expect(checkAndRecord('c', false, t0 + 16 * 60_000)).toBe('unauthorized');
  });
});
