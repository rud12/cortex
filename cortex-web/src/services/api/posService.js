import axios from 'axios';

import { POS_API_URL } from './env';
import { posApi } from './clients';

export const posService = {
  async health() {
    const res = await axios.get(`${POS_API_URL}/api/v1/health`, { timeout: 5000 });
    return res.data;
  },

  async createTransaction(payload) {
    const res = await posApi.post('/transactions', payload);
    return res.data;
  },

  async listTransactions() {
    const res = await posApi.get('/transactions');
    return res.data;
  },

  async getTransaction(id) {
    const res = await posApi.get(`/transactions/${id}`);
    return res.data;
  },

  async getCustomerByPhone(phone) {
    const res = await posApi.get(`/customers/by-phone?phone=${encodeURIComponent(phone)}`);
    return res.data;
  },

  async downloadBillPdf(transactionId) {
    const res = await posApi.get(`/transactions/${encodeURIComponent(transactionId)}/bill.pdf`, {
      responseType: 'blob'
    });

    const contentType = String(res.headers?.['content-type'] || '');
    if (contentType.includes('application/json')) {
      const payload = await res.data.text();
      try {
        const parsed = JSON.parse(payload);
        throw new Error(parsed?.error?.message || 'Failed to download bill PDF');
      } catch {
        throw new Error('Failed to download bill PDF');
      }
    }

    const disposition = String(res.headers?.['content-disposition'] || '');
    const fileNameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
    const fileName = fileNameMatch ? decodeURIComponent(fileNameMatch[1]).replace(/"/g, '') : null;

    return { blob: res.data, fileName };
  },

  billPdfUrl(transactionId) {
    return `${POS_API_URL}/api/v1/transactions/${encodeURIComponent(transactionId)}/bill.pdf`;
  }
};
