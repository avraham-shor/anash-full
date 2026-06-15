import styles from "../App.module.css";
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
        item.building_number,
        item.entrance_number && `כניסה ${item.entrance_number}`,
        item.apartment_number && `דירה ${item.apartment_number}`,
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
                        {item.salutation} {item.full_name_search}
                    </h1>
                    {item.synagogue && (
                        <p className={styles.cardHeaderSub}>🕍 {item.synagogue}</p>
                    )}
                </div>

                <div className={styles.cardBody}>
                    {/* Contact */}
                    {(item.husband_mobile || item.wife_mobile || item.home_phone || item.whatsapp_number) && (
                        <div className={styles.cardSection}>
                            <div className={styles.cardSectionTitle}>📞 פרטי קשר</div>
                            {item.husband_mobile && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>נייד בעל</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.husband_mobile}</span>
                                </div>
                            )}
                            {item.wife_mobile && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>נייד אשה</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.wife_mobile}</span>
                                </div>
                            )}
                            {item.home_phone && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>טלפון בית</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.home_phone}</span>
                                </div>
                            )}
                            {item.whatsapp_number && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>וואטסאפ</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.whatsapp_number}</span>
                                </div>
                            )}
                            {(item.email_1 || item.email_2) && (
                                <>
                                    {item.email_1 && (
                                        <div className={styles.cardInfoRow}>
                                            <span className={styles.cardInfoLabel}>אימייל</span>
                                            <span className={`${styles.cardInfoValue} ${styles.ltrValue}`}>{item.email_1}</span>
                                        </div>
                                    )}
                                    {item.email_2 && (
                                        <div className={styles.cardInfoRow}>
                                            <span className={styles.cardInfoLabel}>אימייל 2</span>
                                            <span className={`${styles.cardInfoValue} ${styles.ltrValue}`}>{item.email_2}</span>
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
                    {(item.wife_name || item.father_name || item.children_at_home_count || item.has_married_children || item.is_groom_of_rabbi) && (
                        <div className={styles.cardSection}>
                            <div className={styles.cardSectionTitle}>👨‍👩‍👧‍👦 פרטי משפחה</div>
                            {item.wife_name && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>שם האשה</span>
                                    <span className={styles.cardInfoValue}>{item.wife_name}</span>
                                </div>
                            )}
                            {item.father_name && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>שם האב</span>
                                    <span className={styles.cardInfoValue}>{item.father_name}</span>
                                </div>
                            )}
                            {(item.children_at_home_count !== undefined && item.children_at_home_count !== null) && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>ילדים בבית</span>
                                    <span className={styles.cardInfoValue}>{item.children_at_home_count || 0}</span>
                                </div>
                            )}
                            {item.has_married_children && +item.has_married_children > 0 && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>נשואים</span>
                                    <span className={styles.cardInfoValue}>💍 {item.has_married_children} ילדים נשואים</span>
                                </div>
                            )}
                            {item.is_groom_of_rabbi && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>חתן הרב</span>
                                    <span className={styles.cardInfoValue}>🎩 {item.is_groom_of_rabbi}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Admin section */}
                    {isAdmin && (item.id_number || item.wife_id_number || item.system_phone_1 || item.system_phone_2) && (
                        <div className={`${styles.cardSection} ${styles.adminSection}`}>
                            <div className={styles.cardSectionTitle}>🔐 מידע מנהל</div>
                            {item.id_number && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>ת.ז. בעל</span>
                                    <span className={styles.cardInfoValue}>{item.id_number}</span>
                                </div>
                            )}
                            {item.wife_id_number && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>ת.ז. אשה</span>
                                    <span className={styles.cardInfoValue}>{item.wife_id_number}</span>
                                </div>
                            )}
                            {item.system_phone_1 && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>טלפון מערכת 1</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.system_phone_1}</span>
                                </div>
                            )}
                            {item.system_phone_2 && (
                                <div className={styles.cardInfoRow}>
                                    <span className={styles.cardInfoLabel}>טלפון מערכת 2</span>
                                    <span className={`${styles.cardInfoValue} ${styles.cardPhoneValue}`}>{item.system_phone_2}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Contact action buttons */}
                <div className={styles.contactRow}>
                    <Icon type="phone" contactValue={item.husband_mobile || item.wife_mobile} />
                    <Icon type="whatsapp" contactValue={item.whatsapp_number || item.husband_mobile} />
                    <Icon type="email" contactValue={item.email_1 || item.email_2} />
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
