import styles from "../App.module.css";
import type { User } from '../models/user.ts';
import { getWhatsappUrl } from "../utiles/utiles.ts";
import { Icon } from "./icon.tsx";
import { useState } from "react";


type Props = {
    item: User;
    isAdmin: boolean;
    token: string | null;
};



export function Card({ item, isAdmin, token }: Props) {
    console.log("Card item", item);
    console.log("isAdmin", isAdmin);
    console.log("token", token);
    const [showEditModal, setShowEditModal] = useState(false);



    return (
        <div className={styles.card}>
            <h2>{item.salutation} {item.full_name_search}</h2>
            {item.husband_mobile && <span> 📱 בעל: {item.husband_mobile}</span>}
            {item.wife_mobile && <span> 📱 אשה: {item.wife_mobile}</span>}
            <p> 🏠 {item.city} {item.street} {item.building_number} {item.entrance_number} {item.apartment_number} {item.neighborhood}</p>
            <p> 🕍 {item.synagogue}</p>
            <p> 👶 ילדים בבית: {item.children_at_home_count || 0}</p>
            {item.has_married_children && +item.has_married_children > 0 && <p> 💍 חיתן {item.has_married_children} ילדים</p>}
            {(item.email_1 || item.email_2) && <p>
                {item.email_1 && <span> 📧 אימייל: {item.email_1} </span>}
                {item.email_2 && <span> 📧 אימייל: {item.email_2} </span>}
            </p>}
            {(isAdmin && (item.system_phone_1 || item.system_phone_2)) && <p>
                {isAdmin && item.system_phone_1 && <span> ☎️ טלפון מערכת 1: {item.system_phone_1}</span>}
                {isAdmin && item.system_phone_2 && <span> ☎️ טלפון מערכת 2: {item.system_phone_2}</span>}
            </p>}
            {(item.home_phone || item.whatsapp_number) && <p>
                {item.home_phone && <span> ☎️ טלפון בית: {item.home_phone}</span>}
                {item.whatsapp_number && <span> 💬 מספר וואטסאפ: {item.whatsapp_number}</span>}
            </p>}
            {(item.father_name || item.wife_name) && <p>
                {item.father_name && <p>  שם האב: {item.father_name} </p>}
                {item.wife_name && <p>  שם האשה: {item.wife_name}</p>}
            </p>}
            {item.is_groom_of_rabbi && <p> 🎩 חתן של הרב: {item.is_groom_of_rabbi}</p>}
            {(isAdmin && (item.id_number || item.wife_id_number)) && <p>
                {isAdmin && item.id_number && <span> 🪪 תעודת זהות בעל: {item.id_number} </span>}
                {isAdmin && item.wife_id_number && <span> 🪪 תעודת זהות אשה: {item.wife_id_number} </span>}
            </p>}
            <div className={styles.contactContainer}>
                <Icon type="phone" contactValue={item.husband_mobile || item.wife_mobile} />
                <Icon type="whatsapp" contactValue={item.whatsapp_number || item.husband_mobile} />
                <Icon type="email" contactValue={item.email_1 || item.email_2} />
            </div>
            <div className={styles.editButton}>
                <button onClick={() => setShowEditModal(!showEditModal)}>{showEditModal ? 'ביטול' : 'הוסף סיסמה'}</button>
                {isAdmin && <EditPasswordModal user={item} show={showEditModal} token={token} />}
            </div>
        </div >
    );
}

export function EditPasswordModal({ user, show, token }: { user: User, show: boolean, token: string | null }) {
    if (!show) return null;
    const [password, setPassword] = useState('');
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const res = await fetchPassword(user.id, password, token!);
        console.log(res);
    };
    return (
        <form onSubmit={handleSubmit}>
            <input type="password" placeholder="הכנס סיסמה" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit">שמור</button>
        </form>
    );
}

async function fetchPassword(userId: string, password: string, token: string) {
    const response = await fetch(`${import.meta.env.VITE_BASE_URL}${userId}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
    const data = await response.json();
    return data;
}