import styles from "../App.module.css";
import { getWhatsappUrl } from "../utiles/utiles.ts";

export function Icon({ type, contactValue }: {
    type: 'phone' | 'whatsapp' | 'email';
    contactValue: string | null;
}) {
    if (!contactValue) return null;

    let link, image, text;
    switch (type) {
        case 'phone':
            link = `tel:${contactValue}`;
            image = "/phone-call.png";
            text = "טלפון";
            break;
        case 'whatsapp':
            link = getWhatsappUrl(contactValue);
            image = "/whatsapp.png";
            text = "וואטסאפ";
            break;
        case 'email':
            link = `mailto:${contactValue}`;
            image = "/gmail.png";
            text = "אימייל";
            break;
    }
    return (
        link && <div>
            <a target="_blank" href={link}>
                <img className={styles.icon} src={image} alt={text} />
            </a>
        </div>
    );
}