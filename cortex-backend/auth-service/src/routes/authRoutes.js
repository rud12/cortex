import { Router } from 'express';
import { login, refresh, logout, validateAccessToken } from '../controllers/authController.js';
const router = Router();
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/validate', validateAccessToken);
export default router;
