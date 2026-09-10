import { Injectable } from '@nestjs/common';
import { config } from '../config';

/**
 * Minimal OpenAI-compatible chat client (Z.ai / BigModel GLM).
 * Base URL default: https://api.z.ai/api/paas/v4  → POST {base}/chat/completions
 * Docs: https://docs.z.ai/guides/overview/quick-start
 */
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface ChatUsage { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }

@Injectable()
export class GlmClient {
  get configured() { return !!config.GLM_API_KEY; }
  get model() { return config.GLM_MODEL; }

  /** Streams content deltas; resolves with the full text + usage (when the provider sends it). */
  async stream(messages: ChatMessage[], onDelta: (text: string) => void, opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}): Promise<{ text: string; usage?: ChatUsage; aborted?: boolean }> {
    if (!this.configured) throw new Error('GLM_API_KEY is not set');
    const res = await fetch(`${config.GLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.GLM_API_KEY}`, 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({
        model: config.GLM_MODEL, messages, stream: true, temperature: opts.temperature ?? 0.5, max_tokens: opts.maxTokens ?? 1200,
        // GLM-5.x reasons by default; coaching replies are short, so keep thinking off unless GLM_THINKING=enabled
        thinking: { type: config.GLM_THINKING === 'enabled' ? 'enabled' : 'disabled' },
      }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => '');
      throw new Error(`GLM ${res.status}: ${t.slice(0, 300)}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '', usage: ChatUsage | undefined;
    for (;;) {
      let chunk: Awaited<ReturnType<typeof reader.read>>;
      try { chunk = await reader.read(); } catch (e) {
        if (opts.signal?.aborted) return { text, usage, aborted: true };
        throw e;
      }
      const { value, done } = chunk;
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) { text += delta; onDelta(delta); }
          if (j.usage) usage = j.usage;
        } catch { /* ignore partial json */ }
      }
    }
    return { text, usage };
  }
}
