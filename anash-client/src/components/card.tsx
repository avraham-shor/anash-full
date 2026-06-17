import styles from './card.module.css';
import { USERS_URL } from '../config';
import type { User } from '../models/user.ts';
import { Icon } from "./icon.tsx";
import { useState } from "react";

type Props = {
    item: User;
    role: 'user' | 'admin' | 'owner';
    token: string | null;
};

export function Card({ item, role, token }: Props) {
    const [showEditModal, setShowEditModal] = useState(false);
    const isAdmin = role !== 'user';

    const address = [
        item.street,
        item.buildingNumber,
        item.entranceNumber && `כניסה ${item.entranceNumber}`,
        item.apartmentNumber && `דירה ${item.apartmentNumber}`,
        item.neighborhood,
        item.city,
    ].filter(Boolean).join(', ');

    return (
        <div className={styles.detailPage}>
            <div className={styles.card}>
                {/* Header */}
                <div className={styles.cardHeader}>
                    <div className={styles.cardAvatarCircle}>👤</div>
                    <h1 className={styles.cardHeaderName}>
                        {item.salutation} {item.fullName}
                    </h1>
                    {item.synagogue && (
                        <p className={styles.cardHeaderSub}>🕍 {item.synagogue}</p>
                    )}
                </div>

                <div className={styles.cardBody}>
                    {/* Contact */}
                    {(item.husbandMobile || item.wifeMobile || item.homePhone || item.whatsappNumber) && (
                        <div className={styles.cardSection}>
                            <div className={styles.cardSectionTitle}>📞 פרטי קשר</div>
                            {item.husbandMobile && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>נייד בעל</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.husbandMobile}</span>
                                </div>
                            )}
                            {item.wifeMobile && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>נייד אשה</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.wifeMobile}</span>
                                </div>
                            )}
                            {item.homePhone && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>טלפון בית</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.homePhone}</span>
                                </div>
                            )}
                            {item.whatsappNumber && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>וואטסאפ</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.whatsappNumber}</span>
                                </div>
                            )}
                            {(item.email1 || item.email2) && (
                                <>
                                    {item.email1 && (
                                        <div className={styles.cardInfoRow}>
                                            <span className={styles.cardInfoLabel}>אימייל</span>
                                            <span className={`${styles.cardInfoValue} ${styles.ltrValue}`}>{item.email1}</span>
                                        </div>
                                    )}
                                    {item.email2 && (
                                        <div className={styles.cardInfoRow}>
                                            <span className={styles.cardInfoLabel}>אימייל 2</span>
                                            <span className={`${styles.cardInfoValue} ${styles.ltrValue}`}>{item.email2}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Address */}
                    {address && (
                        <div className={styles.cardSection}>
                            <div className={styles.cardSectionTitle}>🏠 כתובת</div>
                            <div className={styles.cardInfoRow}>
                                <span className={styles.cardInfoLabel}>כתובת</span>
                                <span className={styles.cardInfoValue}>{address}</span>
                            </div>
                        </div>
                    )}

                    {/* Family */}
                    {(item.wifeName || item.fatherName || item.childrenAtHomeCount || item.hasMarriedChildren || item.isGroomOfRabbi) && (
                        <div className={styles.cardSection}>
                            <div className={styles.cardSectionTitle}>👨‍👩‍👧‍👦 פרטי משפחה</div>
                            {item.wifeName && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>שם האשה</span>
                                    <span className={styles.cardInfoValue}>{item.wifeName}</span>
                                </div>
                            )}
                            {item.fatherName && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>שם האב</span>
                                    <span className={styles.cardInfoValue}>{item.fatherName}</span>
                                </div>
                            )}
                            {(item.childrenAtHomeCount !== undefined && item.childrenAtHomeCount !== null) && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>ילדים בבית</span>
                                    <span className={styles.cardInfoValue}>{item.childrenAtHomeCount || 0}</span>
                                </div>
                            )}
                            {item.hasMarriedChildren && +item.hasMarriedChildren > 0 && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>נשואים</span>
                                    <span className={styles.cardInfoValue}>💍 {item.hasMarriedChildren} ילדים נשואים</span>
                                </div>
                            )}
                            {item.isGroomOfRabbi && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>חתן הרב</span>
                                    <span className={styles.cardInfoValue}>🎩 {item.isGroomOfRabbi}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Admin section */}
                    {isAdmin && (item.idNumber || item.wifeIdNumber || item.systemPhone1 || item.systemPhone2) && (
                        <div className={`${styles.cardSection} ${styles.adminSection}`}>
                            <div className={styles.cardSectionTitle}>🔐 מידע מנהל</div>
                            {item.idNumber && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>ת.ז. בעל</span>
                                    <span className={styles.cardInfoValue}>{item.idNumber}</span>
                                </div>
                            )}
                            {item.wifeIdNumber && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>ת.ז. אשה</span>
                                    <span className={styles.cardInfoValue}>{item.wifeIdNumber}</span>
                                </div>
                            )}
                            {item.systemPhone1 && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>טלפון מערכת 1</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.systemPhone1}</span>
                                </div>
                            )}
                            {item.systemPhone2 && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>טלפון מערכת 2</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.systemPhone2}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Contact action buttons */}
                <div className={styles.contactRow}>
                    <Icon type="phone" contactValue={item.husbandMobile || item.wifeMobile} />
                    <Icon type="whatsapp" contactValue={item.whatsappNumber || item.husbandMobile} />
                    <Icon type="email" contactValue={item.email1 || item.email2} />
                </div>

                {/* Owner section */}
                {role === 'owner' && <div className={styles.passwordSection}>
                    <button
                        className={styles.passwordToggleBtn}
                        onClick={() => setShowEditModal(!showEditModal)}
                    >
                        {showEditModal ? '✕ ביטול' : '🔑  הוסף / שנה סיסמה או תפקיד'}
                    </button>
                    {showEditModal && (
                        <EditPasswordModal user={item} show={showEditModal} token={token} onClose={() => setShowEditModal(false)} />
                    )}
                </div>}
            </div>
        </div>
    );
}

type ModalProps = {
    user: User;
    show: boolean;
    token: string | null;
    onClose: () => void;
}

export function EditPasswordModal({ user, show, token, onClose }: ModalProps) {
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<string>(user.role || 'user');
    const [error, setError] = useState('');

    if (!show) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        try {
            await updateUser(user.id, password || undefined, role || undefined, token!);
            onClose();
        } catch {
            setError('שגיאה בשמירה, נסה שוב');
        }
    };

    return (
        <form onSubmit={handleSubmit} className={styles.passwordForm}>
            <input
                type="password"
                placeholder="סיסמה חדשה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.passwordInput}
                dir="ltr"
            />
            <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={styles.passwordInput}
            >
                <option value="">-- תפקיד --</option>
                <option value="user">משתמש</option>
                <option value="admin">מנהל</option>
                <option value="owner">בעלים</option>
            </select>
            <button type="submit" className={styles.passwordSubmitBtn} disabled={!password && !role}>שמור</button>
            {error && <span className={styles.editError}>{error}</span>}
        </form>
    );
}

async function updateUser(userId: string, password: string | undefined, role: string | undefined, token: string) {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    if (password) {
        const res = await fetch(`${USERS_URL}${userId}/password`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ password }),
        });
        if (!res.ok) throw new Error(await res.text());
    }
    if (role) {
        const res = await fetch(`${USERS_URL}${userId}/role`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ role }),
        });
        if (!res.ok) throw new Error(await res.text());
    }
}
