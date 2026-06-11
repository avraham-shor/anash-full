import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import pool from '../db.ts';

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
            const token = jwt.sign(
                { id: row.id, email: row.email_1, name: row.full_name_search, isAdmin: false },
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
            { id: row.id, email: row.email_1, name: row.full_name_search, isAdmin: true },
            secret,
            { expiresIn: '8h' }
        );
        res.json({ token });

    } catch {
        res.status(500).json({ message: 'Database error' });
    }
};
