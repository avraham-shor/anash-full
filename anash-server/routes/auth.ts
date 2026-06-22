import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, getMe, changeOwnPassword, getLoginLogs } from '../controllers/auth-controller.ts';
import { verifyToken } from '../middleware/auth.ts';

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', verifyToken, getMe);
router.post('/change-password', verifyToken, changeOwnPassword);
router.get('/login-logs', verifyToken, getLoginLogs);

export default router;
