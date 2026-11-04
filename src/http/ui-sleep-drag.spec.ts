import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

function setup() {
  const source = readFileSync(join(__dirname, 'ui/app.js'), 'utf8');
  const segments = [
    { stageStart: '64', stageEnd: '180', stageLabel: 'Light · 23:00 → 23:30 · 30 min', stageDuration: '30 min' },
    { stageStart: '200', stageEnd: '424', stageLabel: 'Deep · 23:40 → 01:00 · 80 min', stageDuration: '80 min' },
  ].map(dataset => ({ dataset, classList: { toggle: jest.fn(), remove: jest.fn() } }));
  const tooltip = { textContent: '', hidden: true, offsetWidth: 200, style: { left: '' } };
  const cursor = { setAttribute: jest.fn(), removeAttribute: jest.fn() };
  const readout = { textContent: '' };
  const svg: any = {
    dataset: { start: String(Date.parse('2026-11-01T23:00:00Z')), end: String(Date.parse('2026-11-02T01:00:00Z')) },
    // Simulate a scaled chart: screen x = SVG x / 2 + 10.
    getScreenCTM: () => ({ inverse: () => ({ inverse: true }) }),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform(matrix: any) { return { x: matrix.inverse === true ? (this.x - 10) * 2 : this.x / 2 + 10 }; } }),
    setPointerCapture: jest.fn(), hasPointerCapture: () => true, releasePointerCapture: jest.fn(),
  };
  const elements: Record<string, unknown> = {
    '.sleep-timeline': svg, '.sleep-timeline-wrap': { getBoundingClientRect: () => ({ left: 10, width: 220 }) },
    '.sleep-stage-tooltip': tooltip, '.sleep-stage-cursor': cursor, '.sleep-stage-readout': readout,
  };
  const detail = { querySelector: (selector: string) => elements[selector], querySelectorAll: () => segments };
  const code = source.slice(source.indexOf('function bindSleepTimeline('), source.indexOf('function bindSleepToggle('));
  runInNewContext(code + '\nbindSleepTimeline(detail);', { detail, clock: (s: string) => s.slice(11, 16), t: (s: string) => s });
  const event = (x: number, extra = {}) => ({ clientX: x / 2 + 10, clientY: 50, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, ...extra });
  return { svg, tooltip, cursor, event };
}

it('captures dragging and selects by time across stage rows, gaps and scaled coordinates', () => {
  const { svg, tooltip, cursor, event } = setup();
  svg.onpointermove(event(100));
  expect(tooltip.hidden).toBe(true);
  svg.onpointerdown(event(100));
  expect(svg.setPointerCapture).toHaveBeenCalledWith(1);
  expect(tooltip.textContent).toBe('30 min');
  svg.onpointermove(event(190));
  expect(tooltip.hidden).toBe(true);
  svg.onpointermove(event(300));
  expect(tooltip.textContent).toBe('80 min');
  expect(tooltip.hidden).toBe(false);
  expect(cursor.setAttribute).toHaveBeenCalledWith('x1', 300);
  svg.onpointerleave(); expect(tooltip.hidden).toBe(false);
  svg.onpointerup(event(300, { type: 'pointerup' }));
  expect(svg.releasePointerCapture).toHaveBeenCalledWith(1);
  svg.onpointerleave(); expect(tooltip.hidden).toBe(true);
});

it('clamps drag to chart bounds and clears tooltip on touch cancellation', () => {
  const { svg, tooltip, cursor, event } = setup();
  svg.onpointerdown(event(100, { pointerType: 'touch' }));
  svg.onpointermove(event(600, { pointerType: 'touch' }));
  expect(cursor.setAttribute).toHaveBeenCalledWith('x1', 424);
  expect(tooltip.textContent).toBe('80 min');
  const center = Number.parseFloat(tooltip.style.left);
  expect(center - tooltip.offsetWidth / 2).toBeGreaterThanOrEqual(0);
  expect(center + tooltip.offsetWidth / 2).toBeLessThanOrEqual(220);
  svg.onpointercancel(event(600, { type: 'pointercancel', pointerType: 'touch' }));
  expect(tooltip.hidden).toBe(true);
  expect(cursor.setAttribute).toHaveBeenCalledWith('hidden', '');
});
