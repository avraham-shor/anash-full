import bcrypt from 'bcryptjs';
import db from '../db.ts';
import { users } from '../db/schema.ts';
import { eq, asc, and, or, like, notInArray } from 'drizzle-orm';
import type { Request, Response } from 'express';
import type { JwtParams } from '../interfaces/jwt-params';
import type { AuthRequest } from '../middleware/auth.ts';

const minColumns = {
    id:              users.id,
    salutation:      users.salutation,
    fullNameSearch:  users.fullNameSearch,
    fatherName:      users.fatherName,
    husbandMobile:   users.husbandMobile,
    homePhone:       users.homePhone,
    city:            users.city,
    street:          users.street,
    buildingNumber:  users.buildingNumber,
    entranceNumber:  users.entranceNumber,
    apartmentNumber: users.apartmentNumber,
    neighborhood:    users.neighborhood,
    synagogue:       users.synagogue,
};

const memberColumns = {
    id:                  users.id,
    salutation:          users.salutation,
    firstName:           users.firstName,
    lastName:            users.lastName,
    fatherName:          users.fatherName,
    fullNameSearch:      users.fullNameSearch,
    wifeName:            users.wifeName,
    isGroomOfRabbi:      users.isGroomOfRabbi,
    childrenAtHomeCount: users.childrenAtHomeCount,
    hasMarriedChildren:  users.hasMarriedChildren,
    city:                users.city,
    street:              users.street,
    buildingNumber:      users.buildingNumber,
    apartmentNumber:     users.apartmentNumber,
    entranceNumber:      users.entranceNumber,
    neighborhood:        users.neighborhood,
    synagogue:           users.synagogue,
    homePhone:           users.homePhone,
    husbandMobile:       users.husbandMobile,
    wifeMobile:          users.wifeMobile,
    whatsappNumber:      users.whatsappNumber,
    husbandName:         users.husbandName,
    husbandFatherName:   users.husbandFatherName,
    email1:              users.email1,
};

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
    const { role } = (req as AuthRequest).user as JwtParams;
    const isAdmin = role === 'admin' || role === 'owner';
    try {
        if (isAdmin) {
            const [row] = await db.select().from(users).where(eq(users.id, id));
            res.json(row);
        } else {
            const [row] = await db.select(memberColumns).from(users).where(eq(users.id, id));
            res.json(row);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserByFullName = async (req: Request, res: Response): Promise<void> => {
    const { fullname, shul, city } = req.query;
    const names = (fullname as string).split(' ').filter(Boolean);

    const nameConditions = names.map(n => like(users.fullNameSearch, `%${n}%`));
    const shulCondition  = like(users.synagogue, `%${shul ?? ''}%`);
    const cityCondition  = city === 'אחר'
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
    const p = `%${number}%`;

    const phoneCondition = or(
        like(users.homePhone,      p),
        like(users.husbandMobile,  p),
        like(users.wifeMobile,     p),
        like(users.whatsappNumber, p),
        like(users.systemPhone1,   p),
        like(users.systemPhone2,   p),
    );
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
    if (!password) {
        res.status(400).json({ message: 'Password is required' });
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
