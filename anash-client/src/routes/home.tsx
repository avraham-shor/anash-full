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
    const { token, role } = useAuth();
    const shulURL = USERS_URL + 'search/place';
    const phoneURL = USERS_URL + 'search/phone';
    const nameURL = USERS_URL + 'search/name';

    const authHeaders = { Authorization: `Bearer ${token}` };

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
            </div>

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
