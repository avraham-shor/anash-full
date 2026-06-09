import styles from "../App.module.css";
import type { User } from '../models/user.ts';

type Props = {
    item: User;
    isAdmin: boolean;
};

export function ShortCard({ item, isAdmin }: Props) {
    function openDetails() {
        window.location.href = `/users/${item.id}?isAdmin=${isAdmin}`;
    }

    const address = [item.city, item.street, item.building_number, item.neighborhood]
        .filter(Boolean).join(' ');

    return (
        <div className={styles.shortCard} onClick={openDetails}>
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
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', direction: 'ltr' }}>
                                ☎ {item.home_phone}
                            </span>
                        )}
                    </div>
                )}

                {address && (
                    <div className={styles.shortCardRow}>
                        <span style={{ opacity: 0.6, fontSize: '13px' }}>🏠</span>
                        <span className={styles.shortCardRowText}>{address}</span>
                    </div>
                )}

                {item.synagogue && (
                    <div className={styles.shortCardRow}>
                        <span style={{ opacity: 0.6, fontSize: '13px' }}>🕍</span>
                        <span className={styles.shortCardRowText}>{item.synagogue}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
