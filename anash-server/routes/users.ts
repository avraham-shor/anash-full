import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    getUsers,
    getUserById,
    getUserByFullName,
    getUserByPhoneNumber,
    getUsersByPlace,
    updateUserPassword,
    updateUserRole,
    sendEditOtp,
    updateUser,
} from '../controllers/user-controller.ts';

const router = express.Router();

const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { message: 'יותר מדי בקשות, נסה שוב בעוד שעה' },
    standardHeaders: true,
    legacyHeaders: false,
});

// /me routes must come before /:id to avoid being caught as an id param
router.post('/me/send-otp', otpLimiter, sendEditOtp);
router.put('/:id', updateUser);

router.get('/', getUsers);
router.get('/search/name', getUserByFullName);
router.get('/search/phone', getUserByPhoneNumber);
router.get('/search/place', getUsersByPlace);
router.put('/:id/password', updateUserPassword);
router.put('/:id/role', updateUserRole);
router.get('/:id', getUserById);

export default router;
