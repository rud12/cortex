import axios from 'axios';

import { INVENTORY_API_URL } from './env';
import { inventoryApi } from './clients';

export const inventoryService = {
  async health() {
    const res = await axios.get(`${INVENTORY_API_URL}/api/v1/health`, { timeout: 5000 });
    return res.data;
  },

  async listProducts(page = 1, limit = 20, options = {}) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit)
    });
    if (options.includeChildren) params.set('includeChildren', 'true');
    const res = await inventoryApi.get(`/products?${params.toString()}`);
    return res.data;
  },


  async getProduct(id) {
    const res = await inventoryApi.get(`/products/${id}`);
    return res.data;
  },


  async createProduct(formData) {
    const res = await inventoryApi.post('/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async updateProduct(id, formData) {
    const res = await inventoryApi.patch(`/products/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async updateProductThresholds(id, payload) {
    const res = await inventoryApi.patch(`/products/${id}/thresholds`, payload);
    return res.data;
  },

  async deleteProduct(id) {
    const res = await inventoryApi.delete(`/products/${id}`);
    return res.data;
  },

  async listInventory() {
    const res = await inventoryApi.get('/inventory');
    return res.data;
  },

  async listBatches(params = {}) {
    const query = new URLSearchParams();
    if (params.productId) query.set('productId', String(params.productId));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const res = await inventoryApi.get(`/inventory/batches${suffix}`);
    return res.data;
  },

  async receiveStock(payload) {
    const res = await inventoryApi.post('/inventory/receipts', payload);
    return res.data;
  },

  async manualStockEntry(payload) {
    const res = await inventoryApi.post('/inventory/manual-entry', payload);
    return res.data;
  },

  async getProductStockSummary(productId) {
    const res = await inventoryApi.get(`/products/${productId}/stock-summary`);
    return res.data;
  },

  async consumeStock(payload) {
    const res = await inventoryApi.post('/inventory/consume', payload);
    return res.data;
  },

  async listAlerts(resolved = false) {
    const res = await inventoryApi.get(`/alerts?resolved=${resolved ? 'true' : 'false'}`);
    return res.data;
  },

  async listSuppliers() {
    const res = await inventoryApi.get('/suppliers');
    return res.data;
  },

  async createSupplier(payload) {
    const res = await inventoryApi.post('/suppliers', payload);
    return res.data;
  },

  async updateSupplier(id, payload) {
    const res = await inventoryApi.patch(`/suppliers/${id}`, payload);
    return res.data;
  },

  async listPurchaseOrders() {
    const res = await inventoryApi.get('/purchase-orders');
    return res.data;
  },

  async getPurchaseOrder(id) {
    const res = await inventoryApi.get(`/purchase-orders/${id}`);
    return res.data;
  },

  async createPurchaseOrder(payload) {
    const res = await inventoryApi.post('/purchase-orders', payload);
    return res.data;
  },

  async updatePurchaseOrder(id, payload) {
    const res = await inventoryApi.patch(`/purchase-orders/${id}`, payload);
    return res.data;
  },

  async sendPurchaseOrder(id, payload) {
    const res = await inventoryApi.post(`/purchase-orders/${id}/send`, payload);
    return res.data;
  },

  async updatePurchaseOrderStatus(id, status) {
    const res = await inventoryApi.patch(`/purchase-orders/${id}/status`, { status });
    return res.data;
  },

  async getSettings() {
    const res = await inventoryApi.get('/settings');
    return res.data;
  },

  async updateBusinessSettings(payload) {
    const res = await inventoryApi.put('/settings/business', payload);
    return res.data;
  },

  async updateTaxDefaults(payload) {
    const res = await inventoryApi.put('/settings/tax-defaults', payload);
    return res.data;
  },

  async updatePaymentSettings(payload) {
    const res = await inventoryApi.put('/settings/payment', payload);
    return res.data;
  },

  async updateThemeSettings(payload) {
    const res = await inventoryApi.put('/settings/theme', payload);
    return res.data;
  },

  inventoryAssetUrl(pathValue) {
    if (!pathValue) return '/product_placeholder.png';
    const value = String(pathValue);
    if (value === '/product_placeholder.png' || value === 'product_placeholder.png') return '/product_placeholder.png';
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (value.startsWith('/inventory-data/product/')) return `${INVENTORY_API_URL}${value}`;
    if (value.startsWith('inventory-data/product/')) return `${INVENTORY_API_URL}/${value}`;
    return '/product_placeholder.png';
  }
};
