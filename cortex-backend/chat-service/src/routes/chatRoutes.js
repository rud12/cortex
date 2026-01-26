import { Router } from 'express';

import { chatHealth, chatQuery } from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = Router();

router.get('/health', chatHealth);
router.post('/query', authenticateToken, authorize('Administrator'), chatQuery);

export default router;
