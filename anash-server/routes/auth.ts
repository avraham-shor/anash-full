import express from 'express';
import { login } from '../controlers/auth-controller.ts';

const router = express.Router();

router.post('/login', login);

export default router;
