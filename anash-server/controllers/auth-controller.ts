import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import db from '../db.ts';
import { users, userLogins, verificationCodes } from '../db/schema.ts';
import { eq, or, and, gte, desc, asc, sql, gt, isNull, lt, inArray } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { JwtParams } from '../interfaces/jwt-params';
import type { AuthRequest } from '../middleware/auth.ts';
import { sendOtpEmail } from '../utils/email.ts';
import { normalizePhone, phoneMatchCandidates, isPlausiblePhone } from '../utils/phone.ts';
import { setAuthCookie } from '../utils/auth-cookie.ts';

// Stored numbers carry any mix of separators ("053-540 7761", "(054)632.9221") and may or may
// not carry a country code, so the column is reduced to digits and compared against every
// digits-only form the submitted number could have been stored as.
const digitsOnly = (column: AnyPgColumn) => sql`regexp_replace(${column}, '[^0-9]', '', 'g')`;

// Exported for auth-flow.test.ts, which renders this predicate to SQL as a regression test.
export const matchesPhone = (phone: string) => {
    const forms = phoneMatchCandidates(phone);
    return or(
        inArray(digitsOnly(users.husbandMobile), forms),
        inArray(digitsOnly(users.wifeMobile), forms),
    );
};

export const changeOwnPassword = async (req: Request, res: Response): Promise<void> => {
    const { oldPassword, password } = req.body;
    const { id: userId, role } = (req as AuthRequest).user as JwtParams;

    // Allowlist, not a denial of 'user': a 'guest' must never fall through here.
    if (role !== 'admin' && role !== 'owner') {
        res.status(403).json({ message: 'Unauthorized' });
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
            .where(eq(users.id, String(userId)));

        const currentHash = row?.password;

        if (!currentHash) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        if (!currentHash.startsWith('$2')) {
            res.status(401).json({ message: 'חשבון זה אינו תומך בשינוי סיסמה' });
            return;
        }

        const isValid = await bcrypt.compare(oldPassword, currentHash);
        if (!isValid) {
            res.status(401).json({ message: 'הסיסמה הנוכחית שגויה' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, String(userId)));

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
    } catch {
        res.status(500).json({ message: 'Database error' });
    }
};

export const logout = (_req: Request, res: Response): void => {
    res.clearCookie('anash_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
    res.json({ message: 'Logged out' });
};

export const getMe = (req: Request, res: Response): void => {
    const { id, name, role, pwVerified } = (req as AuthRequest).user as JwtParams;
    // Tokens minted before pwVerified existed carry no flag; treat them as unverified.
    res.json({ id, name, role, pwVerified: pwVerified === true });
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const phone = normalizePhone(req.body.phone);
    const { password } = req.body;

    if (!phone) {
        res.status(400).json({ message: 'Phone is required' });
        return;
    }

    // normalizePhone is a formatter, not a validator: without this, "abc" would be handed a guest
    // session and "+972abc" would collapse to the digit "0" and be matched against real rows.
    if (!isPlausiblePhone(phone)) {
        res.status(400).json({ message: 'מספר טלפון לא תקין' });
        return;
    }

    try {
        // The digits-only predicate is deliberately broad, so more than one row can match.
        // Order and limit make which account is returned deterministic instead of arbitrary.
        // The columns the branches below read. Hand-listed on purpose: a column added
        // to db/schema.ts must not join an unauthenticated read on its own.
        const [row] = await db
            .select({
                id: users.id, email1: users.email1, fullName: users.fullName,
                password: users.password, role: users.role,
            })
            .from(users)
            .where(matchesPhone(phone))
            .orderBy(asc(users.id))
            .limit(1);

        const secret = process.env.JWT_SECRET!;

        const issueToken = (params: JwtParams) => {
            const token = jwt.sign(params, secret, { expiresIn: '3d' });
            setAuthCookie(res, token);
            res.json({
                user: {
                    id: params.id,
                    name: params.name,
                    role: params.role,
                    pwVerified: params.pwVerified === true,
                },
            });
        };

        // Unknown number: admitted as a guest, which grants directory read access only.
        // Nothing is recorded — user_logins.userId is NOT NULL with an FK to users,
        // so a guest attempt has no row it could point at.
        if (!row) {
            issueToken({ id: '', name: '', role: 'guest', pwVerified: false });
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

        // Password held back: the member gets in, but capped at 'user' and never write-capable.
        // Passwordless accounts land here too and behave exactly as they did before.
        if (!password) {
            await logLogin(true);
            issueToken({
                id: row.id,
                email: row.email1 ?? undefined,
                name: row.fullName ?? '',
                role: 'user',
                pwVerified: false,
            });
            return;
        }

        if (!row.password?.startsWith('$2')) {
            await logLogin(false);
            res.status(401).json({ message: 'סיסמה שגויה' });
            return;
        }

        const isMatch = await bcrypt.compare(password, row.password);

        if (!isMatch) {
            await logLogin(false);
            res.status(401).json({ message: 'סיסמה שגויה' });
            return;
        }

        // Only a proven password unlocks the account's real role and write access.
        await logLogin(true);
        issueToken({
            id: row.id,
            email: row.email1 ?? undefined,
            name: row.fullName ?? '',
            role: (row.role as JwtParams['role']) || 'user',
            pwVerified: true,
        });

    } catch {
        res.status(500).json({ message: 'Database error' });
    }
};

export const forgotPasswordSendOtp = async (req: Request, res: Response): Promise<void> => {
    const phone = normalizePhone(req.body.phone);
    if (!phone || !isPlausiblePhone(phone)) {
        res.status(400).json({ message: 'מספר טלפון נדרש' });
        return;
    }

    try {
        // The columns the branches below read. Hand-listed on purpose: a column added
        // to db/schema.ts must not join an unauthenticated read on its own.
        const [row] = await db
            .select({ id: users.id, email1: users.email1, password: users.password })
            .from(users)
            .where(matchesPhone(phone))
            .orderBy(asc(users.id))
            .limit(1);

        if (!row) {
            res.status(400).json({ message: 'לא נמצא חשבון עם מספר טלפון זה' });
            return;
        }
        if (!row.password) {
            res.status(400).json({ message: 'לחשבון זה אין סיסמה מוגדרת', noPassword: true });
            return;
        }
        if (!row.email1) {
            res.status(400).json({ message: 'לא נמצאה כתובת דוא"ל בחשבון' });
            return;
        }

        // Clean up expired codes for this user
        await db.delete(verificationCodes).where(
            and(eq(verificationCodes.userId, row.id), lt(verificationCodes.expiresAt, new Date()))
        );

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await db.insert(verificationCodes).values({ userId: row.id, code, expiresAt });
        await sendOtpEmail(row.email1, code);

        const [local, domain] = row.email1.split('@');
        const maskedEmail = `${local[0]}***@${domain[0]}***.${domain.split('.').pop()}`;
        res.json({ maskedEmail });
    } catch {
        res.status(500).json({ message: 'Database error' });
    }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    const phone = normalizePhone(req.body.phone);
    const { otp, newPassword } = req.body;

    if (!phone || !isPlausiblePhone(phone) || !otp || !newPassword) {
        res.status(400).json({ message: 'נדרשים טלפון, קוד וסיסמה חדשה' });
        return;
    }
    if (newPassword.length < 4 || newPassword.length > 128) {
        res.status(400).json({ message: 'הסיסמה חייבת להיות בין 4 ל-128 תווים' });
        return;
    }

    try {
        const [row] = await db
            .select({ id: users.id, password: users.password })
            .from(users)
            .where(matchesPhone(phone))
            .orderBy(asc(users.id))
            .limit(1);

        if (!row?.password) {
            res.status(400).json({ message: 'לא נמצא חשבון עם סיסמה עבור מספר זה' });
            return;
        }

        const [record] = await db
            .select()
            .from(verificationCodes)
            .where(and(
                eq(verificationCodes.userId, row.id),
                eq(verificationCodes.code, otp),
                gt(verificationCodes.expiresAt, new Date()),
                isNull(verificationCodes.usedAt),
            ))
            .limit(1);

        if (!record) {
            res.status(401).json({ message: 'קוד שגוי או שפג תוקפו' });
            return;
        }

        await db
            .update(verificationCodes)
            .set({ usedAt: new Date() })
            .where(eq(verificationCodes.id, record.id));

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, row.id));

        res.json({ message: 'הסיסמה אופסה בהצלחה' });
    } catch {
        res.status(500).json({ message: 'Database error' });
    }
};
