import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const source = readFileSync(join(__dirname, 'ui/app.js'), 'utf8');
const timelineSource = source.slice(source.indexOf('function sleepTimeline('), source.indexOf('function bindSleepToggle('));
const interval = { startTime: '2026-10-31T23:00:00Z', endTime: '2026-11-01T01:00:00Z' };
const segment = (type: string, startTime = interval.startTime, endTime = interval.endTime) => ({ type, startTime, endTime });
function chart(stages: unknown[], bounds = interval): string {
  return runInNewContext(timelineSource + '\nsleepTimeline(data)', {
    data: { interval: bounds, stages }, S: { lang: 'en' }, t: (s: string) => s,
    clock: (s: string) => s.slice(11, 16), num: (n: number) => n.toFixed(1), esc: (s: string) => s,
  });
}

it('renders only four supported stages, keeps original colors, and shows cross-midnight times', () => {
  const html = chart(['AWAKE', 'REM', 'LIGHT', 'DEEP', 'ASLEEP', 'RESTLESS'].map(type => segment(type)));
  expect(html.match(/data-stage-label=/g)).toHaveLength(4);
  for (const type of ['awake', 'rem', 'light', 'deep']) expect(html).toContain(`var(--${type})`);
  expect(html).toContain('23:00 → 01:00');
  expect(html).toContain('class="sleep-stage-cursor"');
  expect(html).toContain('data-stage-duration="120.0 minutes"');
  expect(html).not.toContain('NaN');
});

it('does not invent a timeline from a summary or invalid timestamps', () => {
  expect(chart([])).toContain('noStages');
  expect(chart([segment('LIGHT', 'invalid')])).toContain('noStages');
  expect(chart([segment('LIGHT')], { startTime: interval.endTime, endTime: interval.startTime })).toContain('noStages');
});

it('clips segments to the session and leaves missing time disconnected', () => {
  const html = chart([
    segment('LIGHT', '2026-10-31T22:00:00Z', '2026-10-31T23:30:00Z'),
    segment('DEEP', '2026-11-01T00:00:00Z', '2026-11-01T02:00:00Z'),
  ]);
  expect(html).toContain('23:00 → 23:30');
  expect(html).toContain('00:00 → 01:00');
  expect(html).not.toContain('stroke-opacity');
});

function toggleSetup(api: jest.Mock) {
  const summary = { hidden: false };
  const detail = { hidden: true, dataset: {} as Record<string, string>, innerHTML: '', isConnected: true,
    setAttribute: jest.fn(), removeAttribute: jest.fn(), querySelectorAll: () => [] };
  const card = { style: { minHeight: '', removeProperty: jest.fn() }, getBoundingClientRect: () => ({ height: 400 }),
    querySelector: (selector: string) => selector.includes('summary') ? summary : detail };
  const makeButton = (view: string) => ({ dataset: { sleepToggle: '2026-11-01', sleepView: view }, onclick: async () => {},
    closest: () => card, classList: { toggle: jest.fn() }, setAttribute: jest.fn() });
  const button = makeButton('stages'), summaryButton = makeButton('summary');
  const handler = source.slice(source.indexOf('function bindSleepToggle('), source.indexOf('function sleepSummary('));
  runInNewContext(handler + '\nbindSleepToggle();', { document: { querySelectorAll: () => [summaryButton, button] }, t: (key: string) => key, api, sleepTimeline: () => 'chart', bindSleepTimeline: jest.fn() });
  return { button, summaryButton, summary, detail };
}

it('loads detail on demand, restores summary, and reuses loaded detail', async () => {
  const api = jest.fn().mockResolvedValue({});
  const { button, summaryButton, summary, detail } = toggleSetup(api);
  expect(api).not.toHaveBeenCalled();
  await button.onclick();
  expect(api).toHaveBeenCalledWith('/api/days/2026-11-01/sleep-stages');
  expect(summary.hidden).toBe(true); expect(detail.hidden).toBe(false);
  await summaryButton.onclick();
  expect(summary.hidden).toBe(false); expect(detail.hidden).toBe(true);
  await button.onclick();
  expect(api).toHaveBeenCalledTimes(1);
});

it('allows retry after a request fails', async () => {
  const api = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
  const { button, detail } = toggleSetup(api);
  await button.onclick(); expect(detail.innerHTML).toContain('sleepStagesError');
  await button.onclick(); await button.onclick();
  expect(detail.innerHTML).toBe('chart');
  expect(api).toHaveBeenCalledTimes(2);
});
