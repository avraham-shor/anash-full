import express from 'express';
import { login, changeOwnPassword, getLoginLogs } from '../controllers/auth-controller.ts';
import { verifyToken } from '../middleware/auth.ts';

const router = express.Router();

router.post('/login', login);
router.post('/change-password', changeOwnPassword);
router.get('/login-logs', verifyToken, getLoginLogs);

export default router;
