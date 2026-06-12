import { useState } from 'react';
import { ShortCard } from '../components/short-card.tsx';
import { cities, synagogues } from '../utiles/maps.tsx';
import styles from '../App.module.css';
import type { User } from '../models/user.ts';
import { useAuth } from '../context/auth.tsx';
import { USERS_URL } from '../config';

function Home() {
    const [items, setItems] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState<'phone' | 'name' | ''>('');
    const [synagogue, setSynagogue] = useState('');
    const [city, setCity] = useState('');
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const { token, role, id } = useAuth();
    const shulURL = USERS_URL + 'search/place';
    const phoneURL = USERS_URL + 'search/phone';
    const nameURL = USERS_URL + 'search/name';

    const authHeaders = { Authorization: `Bearer ${token}` };

    function closeModal() {
        setShowPasswordModal(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
    }

    async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPasswordError('הסיסמאות החדשות אינן תואמות');
            return;
        }
        setPasswordError('');
        setPasswordLoading(true);
        try {
            const res = await fetch(`${USERS_URL}${id}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ oldPassword, password: newPassword }),
            });
            if (!res.ok) {
                const data = await res.json();
                setPasswordError(data.message || 'שגיאה בשמירת הסיסמה');
                return;
            }
            closeModal();
        } catch {
            setPasswordError('שגיאת רשת, נסה שוב');
        } finally {
            setPasswordLoading(false);
        }
    }

    function filterByPhone(number: string, currentSynagogue: string = synagogue, currentCity: string = city) {
        fetch(`${phoneURL}?number=${number}&shul=${currentSynagogue}&city=${currentCity}`, { headers: authHeaders })
            .then(res => res.json())
            .then(data => { setItems(data); setHasSearched(true); });
    }

    function filterByName(name: string, currentSynagogue: string = synagogue, currentCity: string = city) {
        fetch(`${nameURL}?fullname=${name}&shul=${currentSynagogue}&city=${currentCity}`, { headers: authHeaders })
            .then(res => res.json())
            .then(data => { setItems(data); setHasSearched(true); });
    }

    function setAllItems() {
        fetch(shulURL + `?shul=${synagogue}&city=${city}`, { headers: authHeaders })
            .then(res => res.json())
            .then(data => { setItems(data); setHasSearched(true); });
    }

    function searchByPlace(syn: string, cty: string) {
        if (searchType === 'phone') {
            filterByPhone(searchQuery, syn, cty);
        } else if (searchType === 'name') {
            filterByName(searchQuery, syn, cty);
        } else if (syn || cty) {
            fetch(`${shulURL}?shul=${syn}&city=${cty}`, { headers: authHeaders })
                .then(res => res.json())
                .then(data => { setItems(data); setHasSearched(true); });
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setSearchType('name');
            filterByName(searchQuery);
        }
    };

    return (
        <div className={styles.homePage}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>רשימת אנ&quot;ש</h1>
                <p className={styles.pageSubtitle}>חפש חברי קהילה לפי שם, טלפון, עיר או בית כנסת</p>
                {(role === 'admin' || role === 'owner') && (
                    <button className={styles.changePasswordBtn} onClick={() => setShowPasswordModal(true)}>
                        🔑 שנה סיסמה
                    </button>
                )}
            </div>

            {showPasswordModal && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h2 className={styles.modalTitle}>שינוי סיסמה</h2>
                        <form className={styles.modalForm} onSubmit={handlePasswordChange}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>סיסמה נוכחית</label>
                                <input
                                    type="password"
                                    className={styles.modalInput}
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>סיסמה חדשה</label>
                                <input
                                    type="password"
                                    className={styles.modalInput}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>אישור סיסמה</label>
                                <input
                                    type="password"
                                    className={styles.modalInput}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                            {passwordError && <p className={styles.formError}>{passwordError}</p>}
                            <div className={styles.modalActions}>
                                <button type="submit" className={styles.modalBtnSave} disabled={passwordLoading}>
                                    {passwordLoading ? 'שומר...' : 'שמור'}
                                </button>
                                <button type="button" className={styles.modalBtnCancel} onClick={closeModal}>
                                    ביטול
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className={styles.searchSection}>
                <div className={styles.searchInputWrapper}>
                    <span className={styles.searchIconInner}>🔍</span>
                    <input
                        type="text"
                        placeholder="הכנס שם או מספר טלפון..."
                        className={styles.searchInputField}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        value={searchQuery}
                    />
                </div>

                <div className={styles.searchActionRow}>
                    <button
                        className={`${styles.btnSecondary} ${searchType === 'phone' ? styles.btnSecondaryActive : ''}`}
                        onClick={() => { setSearchType('phone'); filterByPhone(searchQuery); }}
                    >
                        📱 חיפוש לפי טלפון
                    </button>
                    <button
                        className={`${styles.btnSecondary} ${searchType === 'name' ? styles.btnSecondaryActive : ''}`}
                        onClick={() => { setSearchType('name'); filterByName(searchQuery); }}
                    >
                        👤 חיפוש לפי שם
                    </button>
                    <button
                        className={styles.btnFilterToggle}
                        onClick={() => setShowMoreFilters(!showMoreFilters)}
                    >
                        {showMoreFilters ? '⬆ סגור סינון' : '⚙ סינון נוסף'}
                    </button>
                </div>

                {showMoreFilters && (
                    <div className={styles.filtersSection}>
                        <select
                            className={styles.select}
                            value={city}
                            onChange={(e) => {
                                setSynagogue('');
                                setCity(e.target.value);
                                searchByPlace('', e.target.value);
                            }}
                        >
                            <option value="">כל הערים</option>
                            {cities.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <select
                            className={styles.select}
                            value={synagogue}
                            onChange={(e) => {
                                setSynagogue(e.target.value);
                                searchByPlace(e.target.value, city);
                            }}
                        >
                            <option value="">כל בתי הכנסת</option>
                            {synagogues
                                .filter(s => !city || s.city === city)
                                .map(s => (
                                    <option key={s.value} value={s.value}>{s.lable}</option>
                                ))}
                        </select>
                    </div>
                )}
            </div>

            {items.length > 0 && (
                <div className={styles.resultsSection}>
                    <div className={styles.resultsHeader}>
                        <span className={styles.resultCount}>✓ נמצאו {items.length} תוצאות</span>
                    </div>
                    <div className={styles.resultsGrid}>
                        {items.map(item => (
                            <ShortCard key={item.id} item={item} role={role} />
                        ))}
                    </div>
                </div>
            )}

            {hasSearched && items.length === 0 && (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>🔍</span>
                    <p className={styles.emptyText}>לא נמצאו תוצאות עבור החיפוש</p>
                    <button className={styles.showAllBtn} onClick={setAllItems}>
                        הצג את כל הרשימה
                    </button>
                </div>
            )}

            {!hasSearched && (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>👥</span>
                    <p className={styles.emptyText}>חפש לפי שם, טלפון, עיר או בית כנסת</p>
                    <button className={styles.showAllBtn} onClick={setAllItems}>
                        הצג את כל הרשימה
                    </button>
                </div>
            )}
        </div>
    );
}

export default Home;
