import { Agent } from 'undici';

const CAUSAL_URL = (process.env.CAUSAL_SERVICE_URL || 'http://127.0.0.1:3010');
const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });

export const runCausalAnalysis = async ({ question, timeoutMs = 6000 }) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);

  try {
    const res = await fetch(`${CAUSAL_URL}/api/v1/causal/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question }),
      signal: c.signal,
      dispatcher
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.success) throw new Error(payload?.error?.message || `Causal service failed (${res.status})`);
    return payload.data || {};
  } catch (err) {
    throw new Error(`Causal analysis failed: ${err.message}`);
  } finally {
    clearTimeout(t);
  }
};
