import { Router } from 'express';
import {
  listInventory,
  receiveStock,
  manualStockEntry,
  listBatches,
  getProductStockSummary,
  consumeStock
} from '../controllers/inventoryController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = Router();

router.get('/', authenticateToken, listInventory);
router.post('/receipts', authenticateToken, authorize('WarehouseStaff', 'WarehouseManager', 'Administrator'), receiveStock);
router.post('/manual-entry', authenticateToken, authorize('WarehouseStaff', 'WarehouseManager', 'Administrator'), manualStockEntry);
router.post('/consume', authenticateToken, authorize('Cashier', 'Administrator', 'WarehouseManager'), consumeStock);
router.get('/batches', authenticateToken, listBatches);
router.get('/products/:id/stock-summary', authenticateToken, getProductStockSummary);

export default router;
