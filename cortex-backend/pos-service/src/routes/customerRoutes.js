import { Router } from 'express';
import { getCustomerByPhone } from '../controllers/transactionController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = Router();
router.get('/by-phone', authenticateToken, authorize('Cashier', 'Administrator', 'WarehouseManager'), getCustomerByPhone);
export default router;
