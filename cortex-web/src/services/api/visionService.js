import axios from 'axios';

import { VISION_API_URL } from './env';
import { visionApi } from './clients';

export const visionService = {
  async health() {
    const res = await axios.get(`${VISION_API_URL}/health`, { timeout: 5000 });
    return res.data;
  },

  async getProductReferenceStatus() {
    const res = await visionApi.get('/api/v1/vision/products/reference-status');
    return res.data;
  },

  async uploadProductReferenceImages(productId, files) {
    const fd = new FormData();
    files.forEach((file) => fd.append('files', file));

    const res = await visionApi.post(`/api/v1/vision/products/${productId}/reference-images`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async listProductReferenceImages(productId, limit = 300, variantId = null) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (variantId) query.set('variantId', variantId);
    const res = await visionApi.get(`/api/v1/vision/products/${productId}/reference-images?${query.toString()}`);
    return res.data;
  },

  async deleteProductReferenceImage(productId, imageId, variantId = null) {
    const query = new URLSearchParams();
    if (variantId) query.set('variantId', variantId);
    const suffix = query.toString();
    const res = await visionApi.delete(
      `/api/v1/vision/products/${productId}/reference-images/${encodeURIComponent(imageId)}${suffix ? `?${suffix}` : ''}`
    );
    return res.data;
  },

  async startSession({ cameraId }) {
    const res = await visionApi.post('/api/v1/vision/sessions/start', { cameraId });
    return res.data;
  },

  async getSession(sessionId) {
    const res = await visionApi.get(`/api/v1/vision/sessions/${encodeURIComponent(sessionId)}`);
    return res.data;
  },

  async setSessionRoi(sessionId, roi) {
    const res = await visionApi.patch(`/api/v1/vision/sessions/${encodeURIComponent(sessionId)}/roi`, roi);
    return res.data;
  },

  async stopSession(sessionId, payload = {}) {
    const res = await visionApi.post(`/api/v1/vision/sessions/${encodeURIComponent(sessionId)}/stop`, payload);
    return res.data;
  },

  sessionMjpegUrl(sessionId) {
    if (!sessionId) return '';
    return `${VISION_API_URL}/api/v1/vision/sessions/${encodeURIComponent(sessionId)}/stream.mjpeg`;
  },

  async mobileToken(sessionId) {
    const payload = sessionId ? { sessionId } : {};
    const res = await visionApi.post('/api/v1/vision/mobile/token', payload);
    return res.data;
  },

  async getMobileTokenStatus(token) {
    const res = await visionApi.get(`/api/v1/vision/mobile/${encodeURIComponent(token)}/status`);
    return res.data;
  },

  async revokeMobileToken(token) {
    const res = await visionApi.post(`/api/v1/vision/mobile/${encodeURIComponent(token)}/revoke`);
    return res.data;
  },

  datasetAssetUrl(filePath) {
    if (!filePath) return '';
    const normalized = String(filePath).replace(/^\/+/, '');
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return normalized;
    }
    if (normalized.startsWith('data/')) {
      return `${VISION_API_URL}/vision-data/${normalized.slice('data/'.length)}`;
    }
    if (normalized.startsWith('vision-data/')) {
      return `${VISION_API_URL}/${normalized}`;
    }
    return `${VISION_API_URL}/vision-data/${normalized}`;
  }
};
