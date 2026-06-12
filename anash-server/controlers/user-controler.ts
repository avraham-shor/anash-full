import bcrypt from 'bcryptjs';
import pool from '../db.ts';
import jwt from 'jsonwebtoken';
import type { JwtParams } from '../interfaces/jwt-params';



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

const getUsers = async (req: any, res: any) => {
    try {
        const result = await pool.query(`SELECT ${MIN_ITEMS_TO_SELECT} FROM users ${ORDER_BY_NAME}`);
        res.send(result.rows);
    } catch (err) {
        throw err;
    }
};

const getUserById = async (req: any, res: any) => {
    const header = req.headers.authorization;
    const { id } = req.params;
    
    if (!header) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const token = header.split(' ')[1];
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JwtParams;
        const { role } = decodedToken;
        const isAdmin = role === 'admin' || role === 'owner';
        const result = await pool.query(
            `SELECT ${getItemsToDisplay(isAdmin)} FROM users WHERE id = $1 ${ORDER_BY_NAME}`,
            [id]
        );
        res.send(result.rows[0]);
    } catch (err) {
        res.status(401).json({ message: 'Unauthorized' });
    }
};

const getUserByFullName = async (req: any, res: any) => {
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
        res.send(result.rows);
    } catch (err) {
        throw err;
    }
};

const getUserByPhoneNumber = async (req: any, res: any) => {
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
        res.send(result.rows);
    } catch (err) {
        throw err;
    }
};

const getUsersByPlace = async (req: any, res: any) => {
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
        res.send(result.rows);
    } catch (err) {
        throw err;
    }
};

const updatePasswordOrRole = async (req: any, res: any) => {
    const { id } = req.params;
    const { password, role, oldPassword } = req.body;
    const header = req.headers.authorization;

    if (!header) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const token = header.split(' ')[1];
    let tokenRole: string;
    let tokenId: string;
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JwtParams;
        tokenRole = decodedToken.role ?? '';
        tokenId = String(decodedToken.id);
    } catch {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    if (tokenRole === 'user') {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    // When changing own password, verify the old password first
    if (password && tokenId === String(id)) {
        if (!oldPassword) {
            res.status(400).json({ message: 'נדרשת סיסמה נוכחית' });
            return;
        }
        const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [id]);
        const currentHash = userResult.rows[0]?.password;
        if (!currentHash) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const isValid = await bcrypt.compare(oldPassword, currentHash);
        if (!isValid) {
            res.status(401).json({ message: 'הסיסמה הנוכחית שגויה' });
            return;
        }
    }

    try {
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashedPassword, id]);
        }
        if (role && tokenRole === 'owner') {
            if (!['user', 'admin', 'owner'].includes(role)) {
                res.status(400).json({ message: 'Invalid role' });
                return;
            }
            await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, id]);
        }
        res.send({ message: 'Password or role updated successfully' });
    } catch {
        res.status(500).json({ message: 'Internal server error' });
    }
};



export { getUsers, getUserById, getUserByFullName, getUserByPhoneNumber, getUsersByPlace, updatePasswordOrRole };
