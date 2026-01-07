import { chatApi } from './clients';

export const chatService = {
  async query(payload) {
    const res = await chatApi.post('/chat/query', payload);
    return res.data;
  },

  async health() {
    const res = await chatApi.get('/chat/health');
    return res.data;
  }
};
