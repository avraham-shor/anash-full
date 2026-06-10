import bcrypt from 'bcryptjs';
import pool from '../db.ts';

const MIN_ITEMS_TO_SELECT = 'id, salutation, full_name_search, father_name, husband_mobile, home_phone, city, street, building_number, entrance_number, apartment_number, neighborhood, synagogue';

const EXCLUDED_CITIES = `('ירושלים', 'מודיעין עילית', 'ביתר עילית', 'בני ברק', 'טבריה', 'גבעת זאב')`;

const ORDER_BY_NAME = ` ORDER BY last_name, first_name`;

const getItemsToDisplay = (isAdmin: string) => {
    const isAdminBoolean = isAdmin === 'true';
    return isAdminBoolean ?
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
    const { isAdmin } = req.query;
    try {
        const result = await pool.query(
            `SELECT ${getItemsToDisplay(isAdmin)} FROM users WHERE id = $1 ${ORDER_BY_NAME}`,
            [req.params.id]
        );
        res.send(result.rows[0]);
    } catch (err) {
        throw err;
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
    AND synagogue LIKE $7 ${ORDER_BY_NAME}`;

    if (city === 'אחר') {
        sqlQuery += ` AND city NOT IN ${EXCLUDED_CITIES}`;
    } else {
        sqlParams.push(`%${city || ''}%`);
        sqlQuery += ` AND city LIKE $8`;
    }

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

const updatePassword = async (req: any, res: any) => {
    const { id } = req.params;
    const { password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashedPassword, id]);
        res.send({ message: 'Password updated successfully' });
    } catch (err) {
        throw err;
    }
};

export { getUsers, getUserById, getUserByFullName, getUserByPhoneNumber, getUsersByPlace, updatePassword };
