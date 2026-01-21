import { Router } from 'express';
import { createTransaction, listTransactions, getTransaction, getTransactionBillPdf } from '../controllers/transactionController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = Router();
router.post('/', authenticateToken, authorize('Cashier', 'Administrator'), createTransaction);
router.get('/', authenticateToken, authorize('Cashier', 'Administrator', 'WarehouseManager'), listTransactions);
router.get('/:id/bill.pdf', authenticateToken, authorize('Cashier', 'Administrator', 'WarehouseManager'), getTransactionBillPdf);
router.get('/:id', authenticateToken, authorize('Cashier', 'Administrator', 'WarehouseManager'), getTransaction);
export default router;
