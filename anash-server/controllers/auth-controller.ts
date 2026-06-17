import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import db from '../db.ts';
import { users, userLogins } from '../db/schema.ts';
import { eq, or, and, gte, desc, sql } from 'drizzle-orm';
import type { JwtParams } from '../interfaces/jwt-params';
import type { AuthRequest } from '../middleware/auth.ts';

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
        const [row] = await db
            .select({ password: users.password })
            .from(users)
            .where(eq(users.id, userId));

        const currentHash = row?.password;
        console.log('currentHash', currentHash);

        if (!currentHash) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const isValid = oldPassword === currentHash || await bcrypt.compare(oldPassword, currentHash);
        if (!isValid) {
            res.status(401).json({ message: 'הסיסמה הנוכחית שגויה' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));

        res.json({ message: 'הסיסמה עודכנה בהצלחה' });
    } catch {
        res.status(500).json({ message: 'Database error' });
    }
};

export const getLoginLogs = async (req: Request, res: Response): Promise<void> => {
    const { role } = (req as AuthRequest).user as JwtParams;
    if (role !== 'owner') {
        res.status(403).json({ message: 'Unauthorized' });
        return;
    }

    const conditions = [];

    if (req.query.success !== undefined) {
        conditions.push(eq(userLogins.success, req.query.success === 'true'));
    }

    const period = req.query.period as string | undefined;
    if (period === 'today') conditions.push(gte(userLogins.loggedInAt, sql`CURRENT_DATE`));
    else if (period === 'week') conditions.push(gte(userLogins.loggedInAt, sql`DATE_TRUNC('week', NOW())`));
    else if (period === 'month') conditions.push(gte(userLogins.loggedInAt, sql`DATE_TRUNC('month', NOW())`));
    else if (period === 'year') conditions.push(gte(userLogins.loggedInAt, sql`DATE_TRUNC('year', NOW())`));

    try {
        const rows = await db
            .select({
                id: userLogins.id,
                userId: userLogins.userId,
                loggedInAt: userLogins.loggedInAt,
                ipAddress: userLogins.ipAddress,
                userAgent: userLogins.userAgent,
                success: userLogins.success,
                fullName: users.fullName,
                city: users.city,
            })
            .from(userLogins)
            .innerJoin(users, eq(users.id, userLogins.userId))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(userLogins.loggedInAt));

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Database error ' + error });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const { phone, password } = req.body;

    if (!phone) {
        res.status(400).json({ message: 'Phone is required' });
        return;
    }

    try {
        const [row] = await db
            .select()
            .from(users)
            .where(or(
                eq(users.husbandMobile, phone),
                eq(users.wifeMobile, phone),
            ));

        if (!row) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        const ip = req.ip ?? null;
        const ua = (req.headers['user-agent'] as string) ?? null;

        const logLogin = (success: boolean) =>
            db.insert(userLogins).values({
                userId: row.id,
                ipAddress: ip,
                userAgent: ua,
                success,
            });

        const secret = process.env.JWT_SECRET!;

        if (!password) {
            const token = jwt.sign({
                id: row.id,
                email: row.email1,
                name: row.fullName,
                role: 'user',
            } as JwtParams, secret, { expiresIn: '8h' });
            await logLogin(true);
            res.json({ token });
            return;
        }

        const isMatch = row.password?.startsWith('$2')
            ? await bcrypt.compare(password, row.password)
            : row.password === password;

        if (!isMatch) {
            await logLogin(false);
            res.status(401).json({ message: 'סיסמה שגויה' });
            return;
        }

        const token = jwt.sign({
            id: row.id,
            email: row.email1,
            name: row.fullName,
            role: row.role || 'user',
        } as JwtParams, secret, { expiresIn: '8h' });
        await logLogin(true);
        res.json({ token });

    } catch {
        res.status(500).json({ message: 'Database error' });
    }
};
