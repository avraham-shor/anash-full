import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/auth.tsx';
import styles from '../App.module.css';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(phone, password || undefined);
            navigate('/', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'שגיאה בהתחברות');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="App">
            <h1>כניסה לרשימת אנ"ש</h1>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <input
                    type="phone"
                    placeholder="מספר סלולרי"
                    className={styles.searchInput}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    dir="ltr"
                    autoComplete="phone"
                />
                <input
                    type="password"
                    placeholder="סיסמה (אופציונלי)"
                    className={styles.searchInput}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    dir="ltr"
                    autoComplete="current-password"
                />
                <p style={{ fontSize: '14px', color: 'var(--text)', margin: '4px 0 12px', maxWidth: '80%' }}>
                    אם יש לכם סיסמה אנא הקלידו אותה.
                    <br />
                    אחרת - הכניסו מספר סלולרי בלבד.
                </p>
                {error && (
                    <p style={{ color: 'var(--accent)', margin: '4px 0 8px' }}>{error}</p>
                )}
                <button
                    type="submit"
                    className={styles.searchButton}
                    disabled={loading}
                >
                    {loading ? 'מתחבר...' : 'כניסה'}
                </button>
            </form>
        </div>
    );
}
