import sqlite3 from 'sqlite3';
import fs from 'fs';

const db = new sqlite3.Database('./anash-test.db');
//dropTable();


// Create table
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT,
    created_at DATETIME,
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
    password TEXT
  )`);
});


// add column password
async function addPasswordColumn() {
    db.run('ALTER TABLE users ADD COLUMN password TEXT');
}
// addPasswordColumn();



async function fillDBWithAnash() {
    const anash = fs.readFileSync('public/jsons/anash.json', 'utf-8');
    const users = JSON.parse(anash);

    users.forEach(user => {
        db.run(
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
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )`,
            [
                user.id,
                user.created_at,
                user.salutation,
                user.first_name,
                user.last_name,
                user.father_name,
                user.wife_name,
                user.wife_last_name,
                user.wife_father_name,
                user.id_number,
                user.wife_id_number,
                user.birth_date,
                user.wife_birth_date,
                user.city,
                user.street,
                user.building_number,
                user.apartment_number,
                user.entrance_number,
                user.neighborhood,
                user.synagogue,
                user.home_phone,
                user.husband_mobile,
                user.wife_mobile,
                user.whatsapp_number,
                user.system_phone_1,
                user.system_phone_2,
                user.email_1,
                user.email_2,
                user.wants_to_register,
                user.husband_name,
                user.husband_father_name,
                user.is_groom_of_rabbi,
                user.children_at_home_count,
                user.has_married_children,
                user.full_name_search,
                user.city_lat,
                user.city_lon,
                user.street_lat,
                user.street_lon,
                JSON.stringify(user.coordinates)
            ]);
    });

}

//fillDBWithAnash();

async function dropTable() {
    db.run('DROP TABLE IF EXISTS users');
}
// dropTable();


// Query data
db.serialize(() => {
    db.all('SELECT * FROM users', (err, rows) => {
        if (err) {
            throw err;
        }
        console.log(rows[0]);

        rows.forEach(user => {
            const userNameRev = user.full_name_search.split('').reverse().join('');
            // console.log(userNameRev, user.password);

        });
        console.log(rows.length);

    });
});

// Close database
db.close();
