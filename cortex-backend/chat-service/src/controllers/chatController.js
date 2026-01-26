import { handleChatQuery } from '../services/chatOrchestrator.js';
import { error, success } from '../utils/response.js';

export const chatHealth = (req, res) => success(res, { status: 'ok' }, 'Chat service healthy');

export const chatQuery = async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return error(res, 400, 'INVALID_REQUEST', 'question is required');

  const payload = await handleChatQuery({
    question,
    sessionId: String(req.body?.sessionId || 'user-'),
    bearerToken: req.headers?.authorization || ''
  });
  
  return success(res, payload, 'Chat response generated');
};
