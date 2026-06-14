import express from 'express';
import { login, changeOwnPassword } from '../controlers/auth-controller.ts';

const router = express.Router();

router.post('/login', login);
router.post('/change-password', changeOwnPassword);

export default router;
