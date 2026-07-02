import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    login,
    logout,
    getMe,
    changeOwnPassword,
    getLoginLogs,
    forgotPasswordSendOtp,
    resetPassword,
} from '../controllers/auth-controller.ts';
import { verifyToken } from '../middleware/auth.ts';

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { message: 'יותר מדי בקשות, נסה שוב בעוד שעה' },
    standardHeaders: true,
    legacyHeaders: false,
});

const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'יותר מדי נסיונות, נסה שוב מאוחר יותר' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', verifyToken, getMe);
router.post('/change-password', verifyToken, changeOwnPassword);
router.get('/login-logs', verifyToken, getLoginLogs);
router.post('/forgot-password/send-otp', forgotPasswordLimiter, forgotPasswordSendOtp);
router.post('/forgot-password/reset', resetPasswordLimiter, resetPassword);

export default router;
