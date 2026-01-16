import { Router } from 'express';
import {
  getSettings,
  updateBusinessSettings,
  updateTaxDefaults,
  updatePaymentSettings,
  updateThemeSettings
} from '../controllers/settingsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = Router();

router.get('/', authenticateToken, getSettings);
router.put('/business', authenticateToken, authorize('Administrator'), updateBusinessSettings);
router.put('/tax-defaults', authenticateToken, authorize('Administrator'), updateTaxDefaults);
router.put('/payment', authenticateToken, authorize('Administrator'), updatePaymentSettings);
router.put('/theme', authenticateToken, authorize('Administrator'), updateThemeSettings);

export default router;
