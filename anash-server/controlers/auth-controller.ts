import type { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const db = new sqlite3.Database('./anash-test.db');

export const login = (req: Request, res: Response): void => {
    console.log("req.body :>> ", req.body);
    const { phone, password } = req.body;

    if (!phone) {
        res.status(400).json({ message: 'Phone is required' });
        return;
    }

    db.get(
        `SELECT * FROM users WHERE husband_mobile = ? or wife_mobile = ?`,
        [phone, phone],
        async (err, row: any) => {
            if (err) {
                res.status(500).json({ message: 'Database error' });
                return;
            }
            if (!row) {
                res.status(401).json({ message: 'Invalid credentials' });
                return;
            }
            console.log("login row :>> ", row);

            const secret = process.env.JWT_SECRET!;

            // No password → regular user
            if (!password) {
                const token = jwt.sign({ id: row.id, email: row.email_1, name: row.full_name_search, isAdmin: false }, secret, { expiresIn: '8h' });
                res.json({ token });
                return;
            }

            // Password provided → check against DB (hardcoded for testing)
            // row.password = "1234";
            const isMatch = row.password.startsWith('$2')
                ? await bcrypt.compare(password, row.password)
                : row.password === password;

            if (!isMatch) {
                res.status(401).json({ message: 'סיסמה שגויה' });
                return;
            }

            const token = jwt.sign({ id: row.id, email: row.email_1, name: row.full_name_search, isAdmin: true }, secret, { expiresIn: '8h' });
            res.json({ token });
        }
    );
};
