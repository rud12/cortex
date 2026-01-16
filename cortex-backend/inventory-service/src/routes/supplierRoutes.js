import { Router } from 'express';
import { createSupplier, listSuppliers, updateSupplier } from '../controllers/supplierController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = Router();

router.post('/', authenticateToken, authorize('WarehouseManager', 'Administrator'), createSupplier);
router.get('/', authenticateToken, listSuppliers);
router.patch('/:id', authenticateToken, authorize('WarehouseManager', 'Administrator'), updateSupplier);

export default router;
