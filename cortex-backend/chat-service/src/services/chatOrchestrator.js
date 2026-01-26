import { Agent } from 'undici';
import { runCausalAnalysis } from './causalClient.js';

const WEBHOOK = process.env.N8N_CHAT_WEBHOOK_URL || 'https://127.0.0.1:5678/webhook/chatbot-api';
const N8N_TIMEOUT = Math.max(1000, Number(process.env.N8N_TIMEOUT_MS || 30000));
const CAUSAL_WORDS = ['why', 'reason', 'cause', 'impact', 'effect', 'driver', 'because'];

const insecureDispatcher = process.env.NODE_ENV === 'production' ? undefined : new Agent({ connect: { rejectUnauthorized: false } });

const tryParseOutput = (val) => {
  if (typeof val === 'string') {
    const raw = val.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1').trim();
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try { return JSON.parse(raw); } catch { return val; }
    }
    return val;
  }
  return val;
};

const extractLLMReply = (obj) => {
  if (typeof obj === 'string') return obj;
  if (!obj || typeof obj !== 'object') return '';
  for (const k of ['reply', 'message', 'answer', 'text', 'output', 'response']) {
    if (obj[k]) {
      const v = tryParseOutput(obj[k]);
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (v && typeof v === 'object' && v.reply) return v.reply;
    }
  }
  return obj.response?.generations?.[0]?.[0]?.text || obj.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const sendRequest = async (url, body, token) => {
  const reqToken = process.env.N8N_BEARER_TOKEN?.trim() || token || '';
  const headers = { 'Content-Type': 'application/json' };
  if (reqToken) headers.Authorization = reqToken.startsWith('Bearer ') ? reqToken : `Bearer ${reqToken}`;

  const c = new AbortController();
  const t = setTimeout(() => c.abort(), N8N_TIMEOUT);
  try {
    const res = await fetch(url.trim(), { method: 'POST', headers, body: JSON.stringify(body), dispatcher: insecureDispatcher, signal: c.signal });
    const text = await res.text().catch(() => '');
    if (!res.ok) throw new Error(text || `Failed ${res.status}`);
    try { return JSON.parse(text); } catch { return { reply: text }; }
  } finally {
    clearTimeout(t);
  }
};

export const handleChatQuery = async ({ question, sessionId, bearerToken }) => {
  const isCausal = CAUSAL_WORDS.some(w => String(question || '').toLowerCase().includes(w));
  
  if (isCausal) {
    try {
      const data = await runCausalAnalysis({ question });
      const factLines = (data.factors || []).slice(0, 3).map(f => `${f.name}: ${Number(f.impact_percent) >= 0 ? '+' : ''}${Number(f.impact_percent || 0).toFixed(2)}%`);
      return {
        reply: data.summary?.trim() || (factLines.length ? `Main drivers: ${factLines.join(', ')}` : 'No strong causal drivers found.'),
        mode: 'causal',
        confidence_score: data.confidence_score || 80,
        quality_flags: data.diagnostics || [],
        causal_factors: data.factors || []
      };
    } catch (err) {
      console.error('Causal fallback triggered:', err.message);
    }
  }

  try {
    const raw = await sendRequest(WEBHOOK, { sessionId, question }, bearerToken);
    let payload = Array.isArray(raw?.data) ? raw.data[0] || {} : raw?.data ?? raw;
    payload = payload?.body || payload?.json || payload;

    const reply = extractLLMReply(payload);
    return {
      reply: reply || 'No response generated.',
      mode: 'llm',
      confidence_score: Number(payload?.confidence_score || payload?.confidence || 90),
      quality_flags: reply ? (payload?.flags || payload?.quality_flags || []) : ['EMPTY_REPLY'],
      causal_factors: payload?.causal_factors || payload?.factors || []
    };
  } catch (err) {
    console.error('Chat error:', err.message);
    const authStatus = err.message.includes('401') || err.message.includes('403') ? 'UPSTREAM_AUTH_ERROR' : null;
    return {
      reply: 'LLM response is unavailable right now. Try again.',
      mode: isCausal ? 'causal' : 'llm',
      confidence_score: 0,
      quality_flags: [isCausal ? 'CAUSAL_UPSTREAM_ERROR' : 'LLM_UPSTREAM_ERROR', ...(authStatus ? [authStatus] : [])],
      causal_factors: []
    };
  }
};
