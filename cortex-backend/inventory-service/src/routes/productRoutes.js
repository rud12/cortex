import { Router } from 'express';
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  updateProductThresholds,
  deleteProduct
} from '../controllers/productController.js';
import { getProductStockSummary } from '../controllers/inventoryController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.post('/', authenticateToken, authorize('Administrator', 'WarehouseManager'), upload.any(), createProduct);
router.get('/', authenticateToken, listProducts);
router.get('/:id/stock-summary', authenticateToken, getProductStockSummary);
router.patch('/:id/thresholds', authenticateToken, authorize('Administrator', 'WarehouseManager'), updateProductThresholds);
router.get('/:id', authenticateToken, getProduct);
router.patch('/:id', authenticateToken, authorize('Administrator', 'WarehouseManager'), upload.any(), updateProduct);
router.delete('/:id', authenticateToken, authorize('Administrator', 'WarehouseManager'), deleteProduct);

export default router;
