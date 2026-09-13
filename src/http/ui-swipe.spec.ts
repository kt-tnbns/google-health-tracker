import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

// Exercise the shipped browser handler without needing health data or a database.
function setup() {
  const source = readFileSync(join(__dirname, 'ui/app.js'), 'utf8');
  const handlers: Record<string, (event?: any) => void> = {};
  const classes = new Set(['on']);
  const close = jest.fn();
  const drawer = {
    clientWidth: 390,
    classList: { contains: (s: string) => classes.has(s), add: (s: string) => classes.add(s), remove: (s: string) => classes.delete(s) },
    style: { transform: '', removeProperty() { this.transform = ''; } },
    addEventListener: (name: string, fn: (event?: any) => void) => { handlers[name] = fn; },
  };
  runInNewContext(source.slice(source.indexOf('function bindDrawerSwipe('), source.indexOf('function openDrawer(')) + '\nbindDrawerSwipe(drawer);', { drawer, window: { innerWidth: 390 }, openDrawer: close });
  const touch = (x: number, y: number, interactive = false) => ({ touches: [{ clientX: x, clientY: y }], target: { closest: () => interactive }, cancelable: true, preventDefault: jest.fn() });
  return { handlers, drawer, close, touch };
}

it('dismisses on a right swipe and clears the drag transform', () => {
  const { handlers: h, drawer, close, touch } = setup();
  h.touchstart(touch(30, 200)); const move = touch(150, 205); h.touchmove(move);
  expect(move.preventDefault).toHaveBeenCalled();
  expect(drawer.style.transform).toBe('translateX(120px)');
  h.touchend(); expect(close).toHaveBeenCalledWith(false); expect(drawer.style.transform).toBe('');
});

it.each(['vertical', 'left', 'short', 'input', 'cancel'])('does not dismiss for %s gestures', kind => {
  const { handlers: h, close, drawer, touch } = setup();
  h.touchstart(touch(100, 200, kind === 'input'));
  h.touchmove(touch(kind === 'left' ? 0 : kind === 'short' ? 130 : 230, kind === 'vertical' ? 400 : 205));
  if (kind === 'cancel') h.touchcancel();
  h.touchend(); expect(close).not.toHaveBeenCalled(); expect(drawer.style.transform).toBe('');
});
