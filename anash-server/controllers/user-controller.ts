import bcrypt from 'bcryptjs';
import pool from '../db.ts';
import type { Request, Response } from 'express';
import type { JwtParams } from '../interfaces/jwt-params';
import type { AuthRequest } from '../middleware/auth.ts';

const MIN_ITEMS_TO_SELECT = 'id, salutation, full_name_search, father_name, husband_mobile, home_phone, city, street, building_number, entrance_number, apartment_number, neighborhood, synagogue';

const EXCLUDED_CITIES = `('ירושלים', 'מודיעין עילית', 'ביתר עילית', 'בני ברק', 'טבריה', 'גבעת זאב')`;

const ORDER_BY_NAME = ` ORDER BY last_name, first_name`;

const getItemsToDisplay = (isAdmin: boolean) => {
    return isAdmin ?
        '*' :
        `id, salutation, first_name, last_name, father_name, full_name_search, wife_name, is_groom_of_rabbi,
    children_at_home_count, has_married_children, city, street, building_number, apartment_number,
    entrance_number, neighborhood, synagogue, home_phone, husband_mobile, wife_mobile, whatsapp_number, husband_name, husband_father_name, email_1`;
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query(`SELECT ${MIN_ITEMS_TO_SELECT} FROM users ${ORDER_BY_NAME}`);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { role } = (req as AuthRequest).user as JwtParams;
    const isAdmin = role === 'admin' || role === 'owner';
    try {
        const result = await pool.query(
            `SELECT ${getItemsToDisplay(isAdmin)} FROM users WHERE id = $1 ${ORDER_BY_NAME}`,
            [id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserByFullName = async (req: Request, res: Response): Promise<void> => {
    const { fullname, shul, city } = req.query;
    const names = (fullname as string).split(' ').filter(Boolean);

    const sqlParams: string[] = [];
    let paramIndex = 1;

    let sqlQuery = `SELECT ${MIN_ITEMS_TO_SELECT} FROM users WHERE`;

    for (let i = 0; i < names.length; i++) {
        sqlParams.push(`%${names[i]}%`);
        sqlQuery += `${i === 0 ? ' ' : ' AND '}full_name_search LIKE $${paramIndex++}`;
    }

    sqlParams.push(`%${shul || ''}%`);
    sqlQuery += ` AND synagogue LIKE $${paramIndex++}`;

    if (city === 'אחר') {
        sqlQuery += ` AND city NOT IN ${EXCLUDED_CITIES}`;
    } else {
        sqlParams.push(`%${city || ''}%`);
        sqlQuery += ` AND city LIKE $${paramIndex++}`;
    }

    sqlQuery += ORDER_BY_NAME;

    try {
        const result = await pool.query(sqlQuery, sqlParams);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserByPhoneNumber = async (req: Request, res: Response): Promise<void> => {
    const { number, shul, city } = req.query;
    const phoneParam = `%${number}%`;
    const sqlParams: string[] = [phoneParam, phoneParam, phoneParam, phoneParam, phoneParam, phoneParam, `%${shul || ''}%`];

    let sqlQuery = `
    SELECT ${MIN_ITEMS_TO_SELECT} FROM users
    WHERE
        (home_phone LIKE $1 OR
        husband_mobile LIKE $2 OR
        wife_mobile LIKE $3 OR
        whatsapp_number LIKE $4 OR
        system_phone_1 LIKE $5 OR
        system_phone_2 LIKE $6)
    AND synagogue LIKE $7`;

    if (city === 'אחר') {
        sqlQuery += ` AND city NOT IN ${EXCLUDED_CITIES}`;
    } else {
        sqlParams.push(`%${city || ''}%`);
        sqlQuery += ` AND city LIKE $8`;
    }

    sqlQuery += ORDER_BY_NAME;

    try {
        const result = await pool.query(sqlQuery, sqlParams);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUsersByPlace = async (req: Request, res: Response): Promise<void> => {
    const { shul, city } = req.query;
    const sqlParams: string[] = [`%${shul || ''}%`];
    let sqlQuery = `SELECT ${MIN_ITEMS_TO_SELECT} FROM users WHERE synagogue LIKE $1`;

    if (city && city !== 'אחר') {
        sqlParams.push(`%${city}%`);
        sqlQuery += ' AND city LIKE $2';
    } else if (city === 'אחר') {
        sqlQuery += ` AND city NOT IN ${EXCLUDED_CITIES}`;
    }

    sqlQuery += ORDER_BY_NAME;

    try {
        const result = await pool.query(sqlQuery, sqlParams);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateUserPassword = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
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
        await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashedPassword, id]);
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
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
        await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [newRole, id]);
        res.json({ message: 'Role updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
