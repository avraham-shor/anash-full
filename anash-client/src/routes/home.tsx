import { useState } from 'react';
import { ShortCard } from '../components/short-card.tsx';
import { cities, synagogues } from '../utiles/maps.tsx';
import styles from '../App.module.css';
import type { User } from '../models/user.ts';
import { useAuth } from '../context/auth.tsx';

function Home() {
    const [items, setItems] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState<'phone' | 'name' | ''>('');
    const [synagogue, setSynagogue] = useState('');
    const [city, setCity] = useState('');
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const { token, isAdmin } = useAuth();
    const base = import.meta.env.VITE_BASE_URL;
    const shulURL = base + 'search/place';
    const phoneURL = base + 'search/phone';
    const nameURL = base + 'search/name';

    const authHeaders = { Authorization: `Bearer ${token}` };


    function filterByPhone(number: string, currentSynagogue: string = synagogue, currentCity: string = city) {
        fetch(`${phoneURL}?number=${number}&shul=${currentSynagogue}&city=${currentCity}`, { headers: authHeaders })
            .then(res => res.json())
            .then(data => {
                setItems(data);
            });
    }

    function filterByName(name: string, currentSynagogue: string = synagogue, currentCity: string = city) {
        fetch(`${nameURL}?fullname=${name}&shul=${currentSynagogue}&city=${currentCity}`, { headers: authHeaders })
            .then(res => res.json())
            .then(data => {
                setItems(data);
            });

    }

    function setAllItems() {
        fetch(shulURL + `?shul=${synagogue}&city=${city}`, { headers: authHeaders })
            .then(res => res.json())
            .then(data => {
                setItems(data);
            });
    }

    function searchByPlace(synagogue: string, city: string) {
        if (searchType === 'phone') {
            filterByPhone(searchQuery, synagogue, city);
        } else if (searchType === 'name') {
            filterByName(searchQuery, synagogue, city);
        } else if (synagogue || city) {
            fetch(`${shulURL}?shul=${synagogue}&city=${city}`, { headers: authHeaders })
                .then(res => res.json())
                .then(data => {
                    setItems(data);
                });
        }
    }

    return (
        <div className="App">
            <h3>רשימת אנ"ש</h3>

            <div>
                <input
                    type="text"
                    id="search"
                    placeholder="הכנס שם או מספר טלפון או חלק מהם"
                    className={styles.searchInput}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    value={searchQuery}
                />
                <div className={styles.boxButtons}>
                    <button className={styles.searchButton} onClick={() => { setSearchType('phone'); filterByPhone(searchQuery); }}>חפש לפי טלפון</button>
                    <button className={styles.searchButton} onClick={() => { setSearchType('name'); filterByName(searchQuery); }}>חפש לפי שם</button>
                </div>
            </div>


            <button
                className={styles.searchButton}
                onClick={() => setShowMoreFilters(!showMoreFilters)}
            >
                {showMoreFilters ? "הסתר סינונים נוספים" : "הצג סינונים נוספים"}
            </button>
            {showMoreFilters && <div className={styles.boxButtons}>

                <select
                    id="synagogue"
                    className={styles.searchSelect}
                    value={synagogue}
                    onChange={(e) => {
                        // setCity('');
                        setSynagogue(e.target.value);
                        searchByPlace(e.target.value, city);
                    }}
                >
                    <option value="">כל בתי הכנסת</option>
                    {synagogues.filter((synagogue) => synagogue.city === city).map(synagogue => (
                        <option key={synagogue.value} value={synagogue.value}>
                            {synagogue.lable}
                        </option>
                    ))}
                </select>
                <select
                    id="city"
                    className={styles.searchSelect}
                    value={city}
                    onChange={(e) => {
                        setSynagogue('');
                        setCity(e.target.value);
                        searchByPlace('', e.target.value);
                    }}
                >
                    <option value="">כל הערים</option>
                    {cities.map(city => (
                        <option key={city} value={city}>
                            {city}
                        </option>
                    ))}
                </select>
            </div>}
            {items?.length > 0 && <div className={styles.searchContainer}>
                <h3>נמצאו {items.length} תוצאות</h3>
                <ul>
                    {items.map(
                        item => <div key={item.id}>
                            <ShortCard item={item} isAdmin={isAdmin} />
                        </div>
                    )}
                </ul>
            </div>
            }
            {items?.length === 0 && <div>
                <p>לא נמצאו תוצאות</p>
                <button className={styles.searchButton} onClick={() => setAllItems()}>הצג את כל הרשימה</button>
            </div>}

        </div>
    );
}

export default Home
