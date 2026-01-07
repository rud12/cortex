import axios from 'axios';

import { FORECAST_API_URL } from './env';
import { forecastApi } from './clients';

export const forecastService = {
  async health() {
    const res = await axios.get(`${FORECAST_API_URL}/health`, { timeout: 5000 });
    return res.data;
  },

  async forecast(payload) {
    const res = await forecastApi.post('/forecast', payload);
    return res.data;
  },

  async recommendations(payload) {
    const res = await forecastApi.post('/recommendations', payload);
    return res.data;
  },

  async metrics(params = {}) {
    const res = await forecastApi.get('/metrics', { params });
    return res.data;
  },

  async forecasts(params = {}) {
    const res = await forecastApi.get('/forecasts', { params });
    return res.data;
  }
};
