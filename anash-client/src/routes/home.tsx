import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ShortCard } from '../components/short-card.tsx';
import { Loader } from '../components/loader.tsx';
import { cities, synagogues } from '../utils/maps.ts';
import styles from './home.module.css';
import type { User } from '../models/user.ts';
import { useAuth } from '../context/auth.tsx';
import { USERS_URL, CHANGE_PASSWORD_URL } from '../config';

type SearchType = 'phone' | 'name' | 'place' | '';

function Home() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '');
    const [items, setItems] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [showMoreFilters, setShowMoreFilters] = useState(
        !!(searchParams.get('shul') || searchParams.get('city'))
    );
    const [hasSearched, setHasSearched] = useState(searchParams.size > 0);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const { role } = useAuth();

    const searchType = (searchParams.get('type') ?? '') as SearchType;
    const synagogue = searchParams.get('shul') ?? '';
    const city = searchParams.get('city') ?? '';

    const shulURL = USERS_URL + 'search/place';
    const phoneURL = USERS_URL + 'search/phone';
    const nameURL = USERS_URL + 'search/name';

    useEffect(() => {
        if (searchParams.size === 0) return;
        const q = searchParams.get('q') ?? '';
        const type = searchParams.get('type') ?? '';
        const shul = searchParams.get('shul') ?? '';
        const cty = searchParams.get('city') ?? '';
        setLoading(true);
        let url: string;
        if (type === 'phone') {
            url = `${phoneURL}?number=${q}&shul=${shul}&city=${cty}`;
        } else if (type === 'name') {
            url = `${nameURL}?fullname=${q}&shul=${shul}&city=${cty}`;
        } else {
            url = `${shulURL}?shul=${shul}&city=${cty}`;
        }
        fetch(url, { credentials: 'include' })
            .then(res => res.json())
            .then(data => { setItems(data); setHasSearched(true); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function buildParams(q: string, type: SearchType, shul: string, cty: string): Record<string, string> {
        const p: Record<string, string> = {};
        if (q) p.q = q;
        if (type) p.type = type;
        if (shul) p.shul = shul;
        if (cty) p.city = cty;
        return p;
    }

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
            const res = await fetch(CHANGE_PASSWORD_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
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

    function filterByPhone(number: string, currentSynagogue = synagogue, currentCity = city) {
        setSearchParams(buildParams(number, 'phone', currentSynagogue, currentCity));
        setLoading(true);
        fetch(`${phoneURL}?number=${number}&shul=${currentSynagogue}&city=${currentCity}`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => { setItems(data); setHasSearched(true); setLoading(false); });
    }

    function filterByName(name: string, currentSynagogue = synagogue, currentCity = city) {
        setSearchParams(buildParams(name, 'name', currentSynagogue, currentCity));
        setLoading(true);
        fetch(`${nameURL}?fullname=${name}&shul=${currentSynagogue}&city=${currentCity}`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => { setItems(data); setHasSearched(true); setLoading(false); });
    }

    function setAllItems() {
        setSearchParams(buildParams('', 'place', synagogue, city));
        setLoading(true);
        fetch(`${shulURL}?shul=${synagogue}&city=${city}`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => { setItems(data); setHasSearched(true); setLoading(false); });
    }

    function searchByPlace(syn: string, cty: string) {
        if (searchType === 'phone') {
            filterByPhone(inputValue, syn, cty);
        } else if (searchType === 'name') {
            filterByName(inputValue, syn, cty);
        } else if (syn || cty) {
            setSearchParams(buildParams('', 'place', syn, cty));
            setLoading(true);
            fetch(`${shulURL}?shul=${syn}&city=${cty}`, { credentials: 'include' })
                .then(res => res.json())
                .then(data => { setItems(data); setHasSearched(true); setLoading(false); });
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            filterByName(inputValue);
        }
    };

    function resetSearch() {
        setSearchParams({});
        setItems([]);
        setInputValue('');
        setHasSearched(false);
    }

    return (
        <div className={styles.homePage}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>רשימת אנ&quot;ש</h1>
                <p className={styles.pageSubtitle}>חפש חברי קהילה לפי שם, טלפון, עיר או בית כנסת</p>
                <div className={styles.headerActions}>
                    {(role === 'admin' || role === 'owner') && (
                        <button className={styles.changePasswordBtn} onClick={() => setShowPasswordModal(true)}>
                            🔑 שנה סיסמה
                        </button>
                    )}
                    {role === 'owner' && (
                        <Link to="/login-logs" className={styles.dashboardBtn}>
                            📊 יומן כניסות
                        </Link>
                    )}
                </div>
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
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        value={inputValue}
                    />
                </div>

                <div className={styles.searchActionRow}>
                    <button
                        className={`${styles.btnSecondary} ${searchType === 'phone' ? styles.btnSecondaryActive : ''}`}
                        onClick={() => filterByPhone(inputValue)}
                    >
                        📱 חיפוש לפי טלפון
                    </button>
                    <button
                        className={`${styles.btnSecondary} ${searchType === 'name' ? styles.btnSecondaryActive : ''}`}
                        onClick={() => filterByName(inputValue)}
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
                                searchByPlace(e.target.value, city);
                            }}
                        >
                            <option value="">כל בתי הכנסת</option>
                            {synagogues
                                .filter(s => !city || s.city === city)
                                .map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                        </select>
                    </div>
                )}

                {hasSearched && (
                    <div className={styles.resetRow}>
                        <button className={styles.resetBtn} onClick={resetSearch}>
                            ✕ נקה חיפוש
                        </button>
                    </div>
                )}
            </div>

            {loading && <Loader />}

            {!loading && items.length > 0 && (
                <div className={styles.resultsSection}>
                    <div className={styles.resultsHeader}>
                        <span className={styles.resultCount}>✓ נמצאו {items.length} תוצאות</span>
                    </div>
                    <div className={styles.resultsGrid}>
                        {items.map(item => (
                            <ShortCard key={item.id} item={item} />
                        ))}
                    </div>
                </div>
            )}

            {hasSearched && !loading && items.length === 0 && (
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
