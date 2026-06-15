import styles from './icon.module.css';
import { getWhatsappUrl } from "../utils/utils.ts";

export function Icon({ type, contactValue }: {
    type: 'phone' | 'whatsapp' | 'email';
    contactValue: string | null;
}) {
    if (!contactValue) return null;

    let link = '', image = '', text = '';

    switch (type) {
        case 'phone':
            link = `tel:${contactValue}`;
            image = "/phone-call.png";
            text = "חייג";
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
        default:
            return null;
    }

    return (
        <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.contactBtn}
        >
            <img className={styles.contactBtnIcon} src={image} alt={text} />
            <span className={styles.contactBtnLabel}>{text}</span>
        </a>
    );
}
