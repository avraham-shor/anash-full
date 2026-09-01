import bcrypt from 'bcryptjs';
import 'dotenv/config';
import db from '../db.ts';
import { users, verificationCodes } from '../db/schema.ts';
import { eq, asc, and, like, notInArray, gt, isNull, lt, getTableColumns } from 'drizzle-orm';
import type { Request, Response } from 'express';
import type { JwtParams } from '../interfaces/jwt-params';
import type { AuthRequest } from '../middleware/auth.ts';
import { sendOtpEmail } from '../utils/email.ts';
import { issueAuthToken } from '../utils/auth-cookie.ts';
import { phoneSearchNeedle, isSearchableNeedle } from '../utils/phone.ts';
import { phoneSearchCondition } from '../utils/phone-sql.ts';

const minColumns = {
    id: users.id,
    salutation: users.salutation,
    fullName: users.fullName,
    fatherName: users.fatherName,
    husbandMobile: users.husbandMobile,
    homePhone: users.homePhone,
    city: users.city,
    street: users.street,
    buildingNumber: users.buildingNumber,
    entranceNumber: users.entranceNumber,
    apartmentNumber: users.apartmentNumber,
    neighborhood: users.neighborhood,
    synagogue: users.synagogue,
};

const memberColumns = {
    id: users.id,
    salutation: users.salutation,
    firstName: users.firstName,
    lastName: users.lastName,
    fatherName: users.fatherName,
    fullName: users.fullName,
    wifeName: users.wifeName,
    isGroomOfRabbi: users.isGroomOfRabbi,
    childrenAtHomeCount: users.childrenAtHomeCount,
    hasMarriedChildren: users.hasMarriedChildren,
    city: users.city,
    street: users.street,
    buildingNumber: users.buildingNumber,
    apartmentNumber: users.apartmentNumber,
    entranceNumber: users.entranceNumber,
    neighborhood: users.neighborhood,
    synagogue: users.synagogue,
    homePhone: users.homePhone,
    husbandMobile: users.husbandMobile,
    wifeMobile: users.wifeMobile,
    whatsappNumber: users.whatsappNumber,
    husbandName: users.husbandName,
    husbandFatherName: users.husbandFatherName,
    email1: users.email1,
};

/**
 * Columns that must never be read into a response that answers a client. Named explicitly rather
 * than excluded by a rest-spread, so that a future secret (a reset token, an OTP secret) is added
 * in one obvious place instead of silently joining the elevated view the day it is defined.
 */
const SECRET_USER_COLUMNS = ['password'] as const;

const userColumns = getTableColumns(users);

// Subtracting a name that no longer exists is a silent no-op, so a rename in db/schema.ts would
// quietly put the value back into every elevated response. Fail at module load instead: the
// server refuses to boot rather than booting into a leak.
for (const name of SECRET_USER_COLUMNS) {
    if (!(name in userColumns)) {
        throw new Error(
            `SECRET_USER_COLUMNS names '${name}', which is not a column on users. ` +
            'Reconcile it with db/schema.ts -- an elevated read would otherwise expose it.',
        );
    }
}

/**
 * Every `users` column except those secrets. Derived from the schema rather than hand-listed, so
 * a column added to `db/schema.ts` reaches elevated callers with no edit here. On this read the
 * hash is never fetched, rather than fetched and stripped.
 */
const adminColumns = Object.fromEntries(
    Object.entries(userColumns).filter(
        ([name]) => !(SECRET_USER_COLUMNS as readonly string[]).includes(name),
    ),
) as Omit<typeof userColumns, typeof SECRET_USER_COLUMNS[number]>;

const EXCLUDED_CITIES = ['ירושלים', 'מודיעין עילית', 'ביתר עילית', 'בני ברק', 'טבריה', 'גבעת זאב'];

export const getUsers = async (_req: Request, res: Response): Promise<void> => {
    try {
        const rows = await db
            .select(minColumns)
            .from(users)
            .orderBy(asc(users.lastName), asc(users.firstName));
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const { id: callerId, role } = (req as AuthRequest).user as JwtParams;
    const isAdmin = role === 'admin' || role === 'owner';
    try {
        if (isAdmin) {
            const [row] = await db.select(adminColumns).from(users).where(eq(users.id, id));
            res.json(row);
        } else {
            const [row] = await db.select(memberColumns).from(users).where(eq(users.id, id));
            if (callerId === id) {
                const [{ password }] = await db
                    .select({ password: users.password })
                    .from(users)
                    .where(eq(users.id, id));
                res.json({ ...row, hasPassword: Boolean(password) });
            } else {
                res.json(row);
            }
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserByFullName = async (req: Request, res: Response): Promise<void> => {
    const { fullname, shul, city } = req.query;
    if (!fullname || typeof fullname !== 'string' || fullname.length > 100) {
        res.status(400).json({ message: 'Invalid name' });
        return;
    }
    const names = fullname.split(' ').filter(Boolean);

    const nameConditions = names.map(n => like(users.fullName, `%${n}%`));
    const shulCondition = like(users.synagogue, `%${shul ?? ''}%`);
    const cityCondition = city === 'אחר'
        ? notInArray(users.city, EXCLUDED_CITIES)
        : like(users.city, `%${city ?? ''}%`);

    try {
        const rows = await db
            .select(minColumns)
            .from(users)
            .where(and(...nameConditions, shulCondition, cityCondition))
            .orderBy(asc(users.lastName), asc(users.firstName));
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserByPhoneNumber = async (req: Request, res: Response): Promise<void> => {
    const { number, shul, city } = req.query;
    if (!number || typeof number !== 'string' || number.length > 20 || !number.match(/\d/)) {
        res.status(400).json({ message: 'Invalid phone number' });
        return;
    }
  
    const needle = phoneSearchNeedle(number);
    if (!isSearchableNeedle(needle)) {
        res.status(400).json({ message: 'Invalid phone number' });
        return;
    }

    const phoneCondition = phoneSearchCondition(needle);
    const shulCondition = like(users.synagogue, `%${shul ?? ''}%`);
    const cityCondition = city === 'אחר'
        ? notInArray(users.city, EXCLUDED_CITIES)
        : like(users.city, `%${city ?? ''}%`);

    try {
        const rows = await db
            .select(minColumns)
            .from(users)
            .where(and(phoneCondition, shulCondition, cityCondition))
            .orderBy(asc(users.lastName), asc(users.firstName));
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUsersByPlace = async (req: Request, res: Response): Promise<void> => {
    const { shul, city } = req.query;

    const shulCondition = like(users.synagogue, `%${shul ?? ''}%`);
    const cityCondition = !city
        ? undefined
        : city === 'אחר'
            ? notInArray(users.city, EXCLUDED_CITIES)
            : like(users.city, `%${city}%`);

    try {
        const rows = await db
            .select(minColumns)
            .from(users)
            .where(and(shulCondition, cityCondition))
            .orderBy(asc(users.lastName), asc(users.firstName));
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateUserPassword = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const { password } = req.body;
    const { role } = (req as AuthRequest).user as JwtParams;

    if (role !== 'owner') {
        res.status(403).json({ message: 'Unauthorized' });
        return;
    }
    if (!password || typeof password !== 'string' || password.length < 4 || password.length > 128) {
        res.status(400).json({ message: 'Password must be between 4 and 128 characters' });
        return;
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const { role: newRole } = req.body;
    const { role } = (req as AuthRequest).user as JwtParams;

    if (role !== 'owner') {
        res.status(403).json({ message: 'Unauthorized' });
        return;
    }
    if (!newRole || !['user', 'admin', 'owner'].includes(newRole)) {
        res.status(400).json({ message: 'Invalid role' });
        return;
    }
    try {
        await db.update(users).set({ role: newRole }).where(eq(users.id, id));
        res.json({ message: 'Role updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const sendEditOtp = async (req: Request, res: Response): Promise<void> => {
    const { id: userId } = (req as AuthRequest).user as JwtParams;

    // A guest token names no account. Without this it reaches the query with an empty id and
    // gets a misleading "no email on file" 400 instead of being refused outright.
    if (!userId) {
        res.status(403).json({ message: 'אין הרשאה' });
        return;
    }

    try {
        const [user] = await db
            .select({ email1: users.email1, password: users.password })
            .from(users)
            .where(eq(users.id, userId));

        if (user?.password) {
            res.status(400).json({ message: 'חשבון זה כבר מאובטח בסיסמה' });
            return;
        }
        if (!user?.email1) {
            res.status(400).json({ message: 'לא נמצאה כתובת דוא"ל בחשבון' });
            return;
        }

        // Clean up expired codes for this user
        await db.delete(verificationCodes).where(
            and(eq(verificationCodes.userId, userId), lt(verificationCodes.expiresAt, new Date()))
        );

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await db.insert(verificationCodes).values({ userId, code, expiresAt });
        await sendOtpEmail(user.email1, code);

        const [local, domain] = user.email1.split('@');
        const maskedEmail = `${local[0]}***@${domain[0]}***.${domain.split('.').pop()}`;
        res.json({ maskedEmail });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const ALLOWED_FIELDS = new Set([
    'salutation', 'firstName', 'lastName', 'fatherName',
    'wifeName', 'wifeLastName', 'wifeFatherName',
    'idNumber', 'wifeIdNumber', 'birthDate', 'wifeBirthDate',
    'city', 'street', 'buildingNumber', 'apartmentNumber',
    'entranceNumber', 'neighborhood', 'synagogue',
    'homePhone', 'husbandMobile', 'wifeMobile', 'whatsappNumber',
    'email1', 'email2', 'isGroomOfRabbi', 'childrenAtHomeCount',
    'hasMarriedChildren', 'husbandName', 'husbandFatherName', 'wantsToRegister',
]);

export const updateUser = async (req: Request, res: Response): Promise<void> => {
    const targetId = String(req.params.id);
    const { id: callerId, role, pwVerified } = (req as AuthRequest).user as JwtParams;
    const isAdminOrOwner = role === 'admin' || role === 'owner';

    // A guest token carries an empty id and names no account, so it can never write.
    if (!callerId || (callerId !== targetId && !isAdminOrOwner)) {
        res.status(403).json({ message: 'אין הרשאה' });
        return;
    }

    try {
        if (!isAdminOrOwner) {
            const [current] = await db
                .select({ password: users.password })
                .from(users)
                .where(eq(users.id, targetId));

            if (!current?.password) {
                // No password on account → OTP + newPassword both required
                const { otp, newPassword } = req.body as Record<string, string>;

                if (!otp || !newPassword) {
                    res.status(400).json({ message: 'נדרש קוד אימות וסיסמה חדשה' });
                    return;
                }
                if (newPassword.length < 4 || newPassword.length > 128) {
                    res.status(400).json({ message: 'הסיסמה חייבת להיות בין 4 ל-128 תווים' });
                    return;
                }

                const [record] = await db
                    .select()
                    .from(verificationCodes)
                    .where(and(
                        eq(verificationCodes.userId, callerId),
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
            } else if (pwVerified !== true) {
                // Password is set → the token must have proved it. A token minted from a
                // phone number alone (or before pwVerified existed) fails closed here.
                res.status(403).json({ message: 'נדרשת התחברות עם סיסמה כדי לערוך פרטים אלו' });
                return;
            }
        }

        // Build whitelisted update payload
        const body = req.body as Record<string, unknown>;
        const safeFields: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(body)) {
            if (ALLOWED_FIELDS.has(key)) safeFields[key] = (typeof val === 'string' && val !== '') ? val : null;
        }

        // Hash new password if provided
        const newPassword = typeof body.newPassword === 'string' ? body.newPassword : undefined;
        if (newPassword) {
            safeFields.password = await bcrypt.hash(newPassword, 10);
        }

        // Recompute fullName search index when name fields change
        if ('firstName' in safeFields || 'lastName' in safeFields) {
            const [cur] = await db
                .select({ firstName: users.firstName, lastName: users.lastName })
                .from(users)
                .where(eq(users.id, targetId));
            const fn = ((safeFields.firstName ?? cur?.firstName) as string | null) ?? '';
            const ln = ((safeFields.lastName  ?? cur?.lastName)  as string | null) ?? '';
            safeFields.fullName = `${fn} ${ln}`.trim();
        }

        if (Object.keys(safeFields).length === 0) {
            res.status(400).json({ message: 'אין שדות לעדכון' });
            return;
        }

        await db.update(users).set(safeFields).where(eq(users.id, targetId));

        // The caller just put a password on their own account, but the token in their browser
        // still says pwVerified:false -- which the gate above would now reject on their very next
        // save. Re-issue it so the session stays usable instead of silently going read-only.
        if (newPassword && callerId === targetId) {
            const caller = (req as AuthRequest).user as JwtParams;
            issueAuthToken(res, {
                id: caller.id,
                email: caller.email,
                name: caller.name,
                role: caller.role,
                pwVerified: true,
            }, process.env.JWT_SECRET!);
        }

        res.json({ message: 'עודכן בהצלחה' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
