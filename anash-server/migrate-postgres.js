/**
 * Run once to create the table and seed data from public/jsons/anash.json.
 * Usage: node migrate-postgres.js
 * Requires DATABASE_URL in .env
 */
import pg from 'pg';
import fs from 'fs';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            created_at TIMESTAMP,
            salutation TEXT,
            first_name TEXT,
            last_name TEXT,
            father_name TEXT,
            wife_name TEXT,
            wife_last_name TEXT,
            wife_father_name TEXT,
            id_number TEXT,
            wife_id_number TEXT,
            birth_date TEXT,
            wife_birth_date TEXT,
            city TEXT,
            street TEXT,
            building_number TEXT,
            apartment_number TEXT,
            entrance_number TEXT,
            neighborhood TEXT,
            synagogue TEXT,
            home_phone TEXT,
            husband_mobile TEXT,
            wife_mobile TEXT,
            whatsapp_number TEXT,
            system_phone_1 TEXT,
            system_phone_2 TEXT,
            email_1 TEXT,
            email_2 TEXT,
            wants_to_register TEXT,
            husband_name TEXT,
            husband_father_name TEXT,
            is_groom_of_rabbi TEXT,
            children_at_home_count TEXT,
            has_married_children TEXT,
            full_name_search TEXT,
            city_lat REAL,
            city_lon REAL,
            street_lat REAL,
            street_lon REAL,
            coordinates TEXT,
            password TEXT,
            role TEXT
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_logins (
            id            BIGSERIAL PRIMARY KEY,
            user_id       TEXT        NOT NULL REFERENCES users(id),
            logged_in_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            ip_address    INET,
            user_agent    TEXT,
            success       BOOLEAN       NOT NULL DEFAULT TRUE
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_logins_user_id ON user_logins (user_id, logged_in_at DESC)
    `);

    console.log('Table created (or already exists).');

    const anash = fs.readFileSync('public/jsons/anash.json', 'utf-8');
    const users = JSON.parse(anash);

    let inserted = 0;
    for (const user of users) {
        await pool.query(
            `INSERT INTO users (
                id, created_at, salutation, first_name, last_name, father_name, wife_name,
                wife_last_name, wife_father_name, id_number, wife_id_number, birth_date,
                wife_birth_date, city, street, building_number, apartment_number,
                entrance_number, neighborhood, synagogue, home_phone, husband_mobile,
                wife_mobile, whatsapp_number, system_phone_1, system_phone_2, email_1, email_2,
                wants_to_register, husband_name, husband_father_name, is_groom_of_rabbi,
                children_at_home_count, has_married_children, full_name_search,
                city_lat, city_lon, street_lat, street_lon, coordinates
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40
            ) ON CONFLICT DO NOTHING`,
            [
                user.id, user.created_at, user.salutation, user.first_name, user.last_name,
                user.father_name, user.wife_name, user.wife_last_name, user.wife_father_name,
                user.id_number, user.wife_id_number, user.birth_date, user.wife_birth_date,
                user.city, user.street, user.building_number, user.apartment_number,
                user.entrance_number, user.neighborhood, user.synagogue, user.home_phone,
                user.husband_mobile, user.wife_mobile, user.whatsapp_number, user.system_phone_1,
                user.system_phone_2, user.email_1, user.email_2, user.wants_to_register,
                user.husband_name, user.husband_father_name, user.is_groom_of_rabbi,
                user.children_at_home_count, user.has_married_children, user.full_name_search,
                user.city_lat, user.city_lon, user.street_lat, user.street_lon,
                JSON.stringify(user.coordinates),
            ]
        );
        inserted++;
    }

    console.log(`Done. Inserted ${inserted} users.`);
    await pool.end();
}

migrate().catch((err) => {
    console.error(err);
    process.exit(1);
});
