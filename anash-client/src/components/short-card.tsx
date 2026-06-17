import { Link } from 'react-router';
import styles from './short-card.module.css';
import type { User } from '../models/user.ts';

type Props = {
    item: User;
};

export function ShortCard({ item }: Props) {
    const address = [item.city, item.street, item.buildingNumber, item.neighborhood]
        .filter(Boolean).join(' ');

    return (
        <Link to={`/users/${item.id}`} className={styles.shortCard}>
            <div className={styles.shortCardName}>
                {item.salutation} {item.fullName}
            </div>

            {item.fatherName && (
                <div className={styles.shortCardFather}>ב&quot;ר {item.fatherName}</div>
            )}

            <div className={styles.shortCardInfo}>
                {(item.husbandMobile || item.wifeMobile) && (
                    <div className={styles.shortCardRow}>
                        <span className={styles.phoneBadge}>
                            📱 {item.husbandMobile || item.wifeMobile}
                        </span>
                        {item.homePhone && (
                            <span className={styles.homePhone}>
                                ☎ {item.homePhone}
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
