import { Link } from 'react-router';
import styles from './short-card.module.css';
import type { User } from '../models/user.ts';

type Props = {
    item: User;
};

export function ShortCard({ item }: Props) {
    const address = [item.city, item.street, item.building_number, item.neighborhood]
        .filter(Boolean).join(' ');

    return (
        <Link to={`/users/${item.id}`} className={styles.shortCard}>
            <div className={styles.shortCardName}>
                {item.salutation} {item.full_name_search}
            </div>

            {item.father_name && (
                <div className={styles.shortCardFather}>ב&quot;ר {item.father_name}</div>
            )}

            <div className={styles.shortCardInfo}>
                {(item.husband_mobile || item.wife_mobile) && (
                    <div className={styles.shortCardRow}>
                        <span className={styles.phoneBadge}>
                            📱 {item.husband_mobile || item.wife_mobile}
                        </span>
                        {item.home_phone && (
                            <span className={styles.homePhone}>
                                ☎ {item.home_phone}
                            </span>
                        )}
                    </div>
                )}

                {address && (
                    <div className={styles.shortCardRow}>
                        <span className={styles.iconOpacity}>🏠</span>
                        <span className={styles.shortCardRowText}>{address}</span>
                    </div>
                )}

                {item.synagogue && (
                    <div className={styles.shortCardRow}>
                        <span className={styles.iconOpacity}>🕍</span>
                        <span className={styles.shortCardRowText}>{item.synagogue}</span>
                    </div>
                )}
            </div>
        </Link>
    );
}
