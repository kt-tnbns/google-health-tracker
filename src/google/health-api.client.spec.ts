import { HealthApiClient } from './health-api.client';
import { GoogleOAuthService } from './oauth.service';

describe('HealthApiClient request policy', () => {
  let client: HealthApiClient;
  let fetchMock: jest.SpyInstance;
  const response = (status: number, headers?: Record<string, string>) =>
    new Response(JSON.stringify({ dataPoints: [{ value: 1 }] }), { status, headers });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-15T00:00:00Z') });
    jest.spyOn(Math, 'random').mockReturnValue(0);
    fetchMock = jest.spyOn(globalThis, 'fetch');
    client = new HealthApiClient({ getAccessToken: jest.fn().mockResolvedValue('test-token') } as unknown as GoogleOAuthService);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it.each(['2', 'Tue, 15 Sep 2026 00:00:02 GMT'])('respects Retry-After %s before recovering', async retryAfter => {
    fetchMock.mockResolvedValueOnce(response(429, { 'retry-after': retryAfter })).mockResolvedValueOnce(response(200));
    const result = client.read('steps', 'list', '');
    await jest.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect((await result).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([429, 500, 502, 503, 504])('bounds persistent %s failures to four attempts', async status => {
    fetchMock.mockImplementation(async () => response(status));
    const result = client.read('steps', 'list', '');
    await jest.runAllTimersAsync();
    expect(await result).toMatchObject({ ok: false, items: [], pages: [{ status }] });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry earlier than an excessive server delay', async () => {
    fetchMock.mockResolvedValue(response(429, { 'retry-after': '3600' }));
    const result = await client.read('steps', 'list', '');
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([400, 401, 403])('does not retry %s', async status => {
    fetchMock.mockResolvedValue(response(status));
    expect((await client.read('steps', 'list', '')).ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails incomplete pagination while preserving the actual HTTP status', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      dataPoints: [{ value: 1 }], nextPageToken: 'next-page',
    }), { status: 200 }));
    const result = client.read('steps', 'list', '', { maxPages: 2 });
    await jest.runAllTimersAsync();
    const actual = await result;
    expect(actual.ok).toBe(false);
    expect(actual.items).toEqual([]);
    expect(actual.pages).toHaveLength(2);
    expect(actual.pages[1]).toMatchObject({ status: 200, errorText: 'pagination limit reached (2 pages); more data remains' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['read', 'dailyRollUp'] as const)('rejects unresolved redirect responses in %s', async method => {
    fetchMock.mockResolvedValue(response(302));
    const result = method === 'read'
      ? await client.read('steps', 'list', '')
      : await client.dailyRollUp('steps', '2026-09-14', '2026-09-15');
    expect(result).toMatchObject({ ok: false, items: [], pages: [{ status: 302 }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([new TypeError('fetch failed'), new DOMException('timeout', 'TimeoutError')])('retries transient failure %s', async error => {
    fetchMock.mockRejectedValueOnce(error).mockResolvedValueOnce(response(200));
    const result = client.dailyRollUp('steps', '2026-09-14', '2026-09-15');
    await jest.runAllTimersAsync();
    expect((await result).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('reports persistent network failure as failed instead of treating status zero as success', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const result = client.read('steps', 'list', '');
    await jest.runAllTimersAsync();
    expect(await result).toMatchObject({ ok: false, items: [], pages: [{ status: 0 }] });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('aborts a stalled fetch after 20 seconds and retries it', async () => {
    // Node's native timeout uses real timers; substitute an equivalent fake-clock signal.
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), ms);
      return controller.signal;
    });
    fetchMock.mockImplementationOnce((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(options.signal!.reason));
    })).mockResolvedValueOnce(response(200));
    const result = client.read('steps', 'list', '');
    await jest.advanceTimersByTimeAsync(19_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(20_000);
    await jest.advanceTimersByTimeAsync(1001);
    expect((await result).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serializes concurrent requests and separates their starts by at least 500ms', async () => {
    let finishFirst!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finishFirst = resolve; }))
      .mockResolvedValueOnce(response(200));
    const first = client.listPairedDevices();
    const second = client.listPairedDevices();
    await jest.advanceTimersByTimeAsync(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finishFirst(response(200));
    await first;
    await jest.advanceTimersByTimeAsync(399);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect((await second).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps requests serialized when the first takes longer than the pacing interval', async () => {
    let finishFirst!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finishFirst = resolve; }))
      .mockResolvedValueOnce(response(200));
    const first = client.listPairedDevices();
    const second = client.listPairedDevices();
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finishFirst(response(200));
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
