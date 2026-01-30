import { Router } from 'express';
import { sendViaMail } from '../controllers/notificationController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = Router();
router.post('/mail', authenticateToken, authorize('Administrator', 'WarehouseManager', 'Cashier'), sendViaMail);
export default router;
