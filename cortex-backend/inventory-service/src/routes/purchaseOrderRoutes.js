import { Router } from 'express';
import {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  updatePurchaseOrder,
  sendPurchaseOrderMail,
  updatePurchaseOrderStatus
} from '../controllers/purchaseOrderController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = Router();

router.post('/', authenticateToken, authorize('WarehouseManager', 'Administrator'), createPurchaseOrder);
router.get('/', authenticateToken, authorize('WarehouseManager', 'Administrator'), listPurchaseOrders);
router.get('/:id', authenticateToken, authorize('WarehouseManager', 'Administrator'), getPurchaseOrder);
router.patch('/:id', authenticateToken, authorize('WarehouseManager', 'Administrator'), updatePurchaseOrder);
router.post('/:id/send', authenticateToken, authorize('WarehouseManager', 'Administrator'), sendPurchaseOrderMail);
router.patch('/:id/status', authenticateToken, authorize('WarehouseManager', 'Administrator'), updatePurchaseOrderStatus);

export default router;
