import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router';
import { useAuth } from '../context/auth.tsx';
import { LOGIN_LOGS_URL } from '../config';
import styles from './login-logs.module.css';
import { Loader } from '../components/loader.tsx';

interface LoginLog {
    id: number;
    userId: string;
    loggedInAt: string;
    ipAddress: string | null;
    userAgent: string | null;
    success: boolean;
    fullName: string;
    city: string;
}

type SuccessFilter = 'all' | 'success' | 'fail';
type DatePeriod = 'all' | 'today' | 'week' | 'month' | 'year';

const PERIOD_LABELS: Record<DatePeriod, string> = {
    all: 'הכל',
    today: 'היום',
    week: 'השבוע',
    month: 'החודש',
    year: 'השנה',
};

const PAGE_SIZE = 20;

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
    const [allLogs, setAllLogs] = useState<LoginLog[]>([]);
    const [stats, setStats] = useState({ total: 0, successful: 0, failed: 0 });
    const [filter, setFilter] = useState<SuccessFilter>('all');
    const [periodFilter, setPeriodFilter] = useState<DatePeriod>('all');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);
    const [error, setError] = useState('');

    function buildUrl(df: DatePeriod): string {
        const p = new URLSearchParams();
        if (df !== 'all') p.set('period', df);
        const qs = p.toString();
        return qs ? `${LOGIN_LOGS_URL}?${qs}` : LOGIN_LOGS_URL;
    }

    function fetchLogs(df: DatePeriod, initial = false) {
        if (!initial) setTableLoading(true);
        fetch(buildUrl(df), { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                if (!res.ok) throw new Error();
                return res.json();
            })
            .then((data: LoginLog[]) => {
                setAllLogs(data);
                const successful = data.filter(l => l.success).length;
                setStats({ total: data.length, successful, failed: data.length - successful });
            })
            .catch(() => { if (initial) setError('שגיאה בטעינת יומן הכניסות'); })
            .finally(() => { if (initial) setLoading(false); else setTableLoading(false); });
    }

    useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
        setLoading(true);
        fetchLogs('all', true);
    }, [token]);

    function applySuccessFilter(sf: SuccessFilter) {
        if (sf === filter) return;
        setFilter(sf);
        setPage(1);
    }

    function applyPeriod(df: DatePeriod) {
        if (df === periodFilter) return;
        setPeriodFilter(df);
        setPage(1);
        fetchLogs(df);
    }

    if (role !== 'owner') return <Navigate to="/" replace />;

    const filteredLogs = filter === 'all' ? allLogs : allLogs.filter(l => l.success === (filter === 'success'));
    const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
    const paginatedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
                    <div className={styles.filterRow}>
                        {(['all', 'today', 'week', 'month', 'year'] as DatePeriod[]).map(p => (
                            <button
                                key={p}
                                className={`${styles.filterChip} ${periodFilter === p ? styles.filterChipActive : ''}`}
                                onClick={() => applyPeriod(p)}
                            >
                                {PERIOD_LABELS[p]}
                            </button>
                        ))}
                    </div>

                    <div className={styles.statsRow}>
                        <button
                            className={`${styles.statCard} ${filter === 'all' ? styles.statCardActive : ''}`}
                            onClick={() => applySuccessFilter('all')}
                        >
                            <span className={styles.statNumber}>{stats.total}</span>
                            <span className={styles.statLabel}>סה"כ כניסות</span>
                        </button>
                        <button
                            className={`${styles.statCard} ${styles.statSuccess} ${filter === 'success' ? styles.statCardActive : ''}`}
                            onClick={() => applySuccessFilter('success')}
                        >
                            <span className={styles.statNumber}>{stats.successful}</span>
                            <span className={styles.statLabel}>כניסות מוצלחות</span>
                        </button>
                        <button
                            className={`${styles.statCard} ${styles.statFail} ${filter === 'fail' ? styles.statCardActive : ''}`}
                            onClick={() => applySuccessFilter('fail')}
                        >
                            <span className={styles.statNumber}>{stats.failed}</span>
                            <span className={styles.statLabel}>כניסות כושלות</span>
                        </button>
                    </div>

                    <div className={styles.tableCard}>
                        {tableLoading ? (
                            <Loader />
                        ) : paginatedLogs.length === 0 ? (
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
                                        {paginatedLogs.map(log => (
                                            <tr key={log.id}>
                                                <td>
                                                    <span className={`${styles.badge} ${log.success ? styles.badgeSuccess : styles.badgeFail}`}>
                                                        {log.success ? '✓ הצלחה' : '✗ כשלון'}
                                                    </span>
                                                </td>
                                                <td className={styles.nameCell}>
                                                    <Link to={`/users/${log.userId}`} className={styles.nameLink}>
                                                        {log.fullName}
                                                    </Link>
                                                </td>
                                                <td>{log.city || '—'}</td>
                                                <td className={styles.dateCell}>{formatDate(log.loggedInAt)}</td>
                                                <td className={styles.monoCell}>{log.ipAddress || '—'}</td>
                                                <td className={styles.uaCell} title={log.userAgent ?? ''}>
                                                    {truncate(log.userAgent)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {totalPages > 1 && (
                                    <div className={styles.pagination}>
                                        <button
                                            className={styles.pageBtn}
                                            onClick={() => setPage(p => p - 1)}
                                            disabled={page === 1}
                                        >
                                            →
                                        </button>
                                        <span className={styles.pageInfo}>עמוד {page} מתוך {totalPages}</span>
                                        <button
                                            className={styles.pageBtn}
                                            onClick={() => setPage(p => p + 1)}
                                            disabled={page === totalPages}
                                        >
                                            ←
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default LoginLogs;
