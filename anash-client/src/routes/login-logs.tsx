import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router';
import { useAuth } from '../context/auth.tsx';
import { LOGIN_LOGS_URL } from '../config';
import styles from './login-logs.module.css';
import { Loader } from '../components/loader.tsx';

interface LoginLog {
    id: number;
    user_id: string;
    logged_in_at: string;
    ip_address: string | null;
    user_agent: string | null;
    success: boolean;
    full_name_search: string;
    city: string;
}

type LogFilter = 'all' | 'success' | 'fail';

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function truncate(str: string | null, len = 55) {
    if (!str) return '—';
    return str.length > len ? str.slice(0, len) + '…' : str;
}

function LoginLogs() {
    const { token, role } = useAuth();
    const [logs, setLogs] = useState<LoginLog[]>([]);
    const [stats, setStats] = useState({ total: 0, successful: 0, failed: 0 });
    const [filter, setFilter] = useState<LogFilter>('all');
    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(LOGIN_LOGS_URL, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                if (!res.ok) throw new Error();
                return res.json();
            })
            .then((data: LoginLog[]) => {
                const successful = data.filter(l => l.success).length;
                setStats({ total: data.length, successful, failed: data.length - successful });
                setLogs(data);
                setLoading(false);
            })
            .catch(() => { setError('שגיאה בטעינת יומן הכניסות'); setLoading(false); });
    }, [token]);

    function applyFilter(f: LogFilter) {
        if (f === filter) return;
        setFilter(f);
        setTableLoading(true);
        const url = f === 'all'
            ? LOGIN_LOGS_URL
            : `${LOGIN_LOGS_URL}?success=${f === 'success'}`;
        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => res.json())
            .then((data: LoginLog[]) => { setLogs(data); setTableLoading(false); });
    }

    if (role !== 'owner') return <Navigate to="/" replace />;

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <Link to="/" className={styles.backLink}>← חזרה לדף הבית</Link>
                <h1 className={styles.pageTitle}>📊 יומן כניסות</h1>
                <p className={styles.pageSubtitle}>רשימת כל הכניסות של משתמשים למערכת</p>
            </div>

            {loading && <Loader />}

            {error && (
                <div className={styles.errorBox}>{error}</div>
            )}

            {!loading && !error && (
                <>
                    <div className={styles.statsRow}>
                        <button
                            className={`${styles.statCard} ${filter === 'all' ? styles.statCardActive : ''}`}
                            onClick={() => applyFilter('all')}
                        >
                            <span className={styles.statNumber}>{stats.total}</span>
                            <span className={styles.statLabel}>סה"כ כניסות</span>
                        </button>
                        <button
                            className={`${styles.statCard} ${styles.statSuccess} ${filter === 'success' ? styles.statCardActive : ''}`}
                            onClick={() => applyFilter('success')}
                        >
                            <span className={styles.statNumber}>{stats.successful}</span>
                            <span className={styles.statLabel}>כניסות מוצלחות</span>
                        </button>
                        <button
                            className={`${styles.statCard} ${styles.statFail} ${filter === 'fail' ? styles.statCardActive : ''}`}
                            onClick={() => applyFilter('fail')}
                        >
                            <span className={styles.statNumber}>{stats.failed}</span>
                            <span className={styles.statLabel}>כניסות כושלות</span>
                        </button>
                    </div>

                    <div className={styles.tableCard}>
                        {tableLoading ? (
                            <Loader />
                        ) : logs.length === 0 ? (
                            <div className={styles.centerState}>
                                <span className={styles.emptyIcon}>📋</span>
                                <p className={styles.stateText}>אין כניסות רשומות</p>
                            </div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>סטטוס</th>
                                            <th>שם</th>
                                            <th>עיר</th>
                                            <th>תאריך ושעה</th>
                                            <th>כתובת IP</th>
                                            <th>דפדפן</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map(log => (
                                            <tr key={log.id}>
                                                <td>
                                                    <span className={`${styles.badge} ${log.success ? styles.badgeSuccess : styles.badgeFail}`}>
                                                        {log.success ? '✓ הצלחה' : '✗ כשלון'}
                                                    </span>
                                                </td>
                                                <td className={styles.nameCell}>
                                                    <Link to={`/users/${log.user_id}`} className={styles.nameLink}>
                                                        {log.full_name_search}
                                                    </Link>
                                                </td>
                                                <td>{log.city || '—'}</td>
                                                <td className={styles.dateCell}>{formatDate(log.logged_in_at)}</td>
                                                <td className={styles.monoCell}>{log.ip_address || '—'}</td>
                                                <td className={styles.uaCell} title={log.user_agent ?? ''}>
                                                    {truncate(log.user_agent)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default LoginLogs;
