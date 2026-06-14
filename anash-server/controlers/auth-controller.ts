import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import pool from '../db.ts';
import type { JwtParams } from '../interfaces/jwt-params';

export const changeOwnPassword = async (req: Request, res: Response): Promise<void> => {
    const { oldPassword, password } = req.body;
    console.log('change own password', oldPassword, password);

    const header = req.headers.authorization;

    if (!header) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const token = header.split(' ')[1];
    let userId: string;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtParams;
        if (decoded.role === 'user') {
            res.status(403).json({ message: 'Unauthorized' });
            return;
        }
        userId = String(decoded.id);
    } catch {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    if (!oldPassword || !password) {
        res.status(400).json({ message: 'נדרשת סיסמה נוכחית וסיסמה חדשה' });
        return;
    }

    try {
        const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        const currentHash = result.rows[0]?.password;
        console.log('currentHash', currentHash);

        if (!currentHash) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const isValid = await bcrypt.compare(oldPassword, currentHash);
        if (!isValid) {
            res.status(401).json({ message: 'הסיסמה הנוכחית שגויה' });
            return;
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
        res.json({ message: 'הסיסמה עודכנה בהצלחה' });
    } catch {
        res.status(500).json({ message: 'Database error' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const { phone, password } = req.body;

    if (!phone) {
        res.status(400).json({ message: 'Phone is required' });
        return;
    }

    try {
        const result = await pool.query(
            `SELECT * FROM users WHERE husband_mobile = $1 OR wife_mobile = $2`,
            [phone, phone]
        );
        const row = result.rows[0];

        if (!row) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        const secret = process.env.JWT_SECRET!;

        if (!password) {
            const token = jwt.sign({
                id: row.id,
                email: row.email_1,
                name: row.full_name_search,
                role: 'user'
            } as JwtParams,
                secret,
                { expiresIn: '8h' }
            );
            res.json({ token });
            return;
        }

        //temporary for testing
        if (!row.password) {
            row.password = "9790";
        }

        const isMatch = row.password?.startsWith('$2')
            ? await bcrypt.compare(password, row.password)
            : row.password === password;

        if (!isMatch) {
            res.status(401).json({ message: 'סיסמה שגויה' });
            return;
        }

        const token = jwt.sign(
            {
                id: row.id,
                email: row.email_1,
                name: row.full_name_search,
                role: row.role || 'user'
            } as JwtParams,
            secret,
            { expiresIn: '8h' }
        );
        res.json({ token });

    } catch {
        res.status(500).json({ message: 'Database error' });
    }
};
