import axios from 'axios';

import { AUTH_API_URL } from './env';
import { authApi } from './clients';

export const authService = {
  async login(identifier, password) {
    const res = await axios.post(`${AUTH_API_URL}/api/v1/auth/login`, { identifier, password }, { timeout: 10000 });
    return res.data;
  },

  async refresh(refreshToken) {
    const res = await axios.post(`${AUTH_API_URL}/api/v1/auth/refresh`, { refreshToken }, { timeout: 10000 });
    return res.data;
  },

  async logout(refreshToken) {
    const res = await axios.post(`${AUTH_API_URL}/api/v1/auth/logout`, { refreshToken }, { timeout: 10000 });
    return res.data;
  },

  async createUser(payload) {
    const res = await authApi.post('/api/v1/users', payload);
    return res.data;
  },

  async listUsers() {
    const res = await authApi.get('/api/v1/users');
    return res.data;
  },

  async getUser(id) {
    const res = await authApi.get(`/api/v1/users/${id}`);
    return res.data;
  },

  async updateUser(id, payload) {
    const res = await authApi.patch(`/api/v1/users/${id}`, payload);
    return res.data;
  },

  async deleteUser(id) {
    const res = await authApi.delete(`/api/v1/users/${id}`);
    return res.data;
  },

  async health() {
    const res = await axios.get(`${AUTH_API_URL}/api/v1/health`, { timeout: 5000 });
    return res.data;
  }
};
