import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: jwt.JwtPayload;
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        res.status(401).json({ message: 'Access token required' });
        return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ message: 'Server misconfiguration: JWT_SECRET not set' });
        return;
    }

    try {
        req.user = jwt.verify(token, secret) as jwt.JwtPayload;
        next();
    } catch {
        res.status(403).json({ message: 'Invalid or expired token' });
    }
};
