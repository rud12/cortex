import { Router } from 'express';
import { listAlerts } from '../controllers/alertController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = Router();

router.get('/', authenticateToken, authorize('WarehouseManager', 'Administrator'), listAlerts);

export default router;
