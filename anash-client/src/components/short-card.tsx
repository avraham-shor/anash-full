import styles from "../App.module.css";
import type { User } from '../models/user.ts';

type Props = {
    item: User;
    isAdmin: boolean;
};



export function ShortCard({ item, isAdmin }: Props) {
    function openDatailes() {
        window.location.href = `/users/${item.id}?isAdmin=${isAdmin}`;
    }


    return (
        <div className={styles.shortCard} onClick={() => openDatailes()}>
            <h2 style={{ marginBottom: '0px' }}>{item.salutation} {item.full_name_search}</h2>
            {item.father_name && <p>
                {item.father_name && <span> ב"ר {item.father_name} </span>}
            </p>}
            <p>
                {item.husband_mobile && <span style={{ fontWeight: 'bold' }}> 📱 {item.husband_mobile} </span>}
                {item.home_phone && <span style={{ marginLeft: '10px' }}> ☎️ {item.home_phone}</span>}
            </p>

            <p> 🏠 {item.city} {item.street} {item.building_number} {item.entrance_number} {item.apartment_number} {item.neighborhood}</p>
            <p> 🕍 {item.synagogue}</p>
        </div >
    );
}