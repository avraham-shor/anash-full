import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigate,
  useLocation,
} from 'react-router';

import type { Route } from './+types/root';
import './styles.css';
import { AuthProvider, useAuth } from './context/auth.tsx';
import styles from './root.module.css';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>רשימת אנ"ש</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <div id="root">
          {children}
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function AppHeader() {
  const { token, logout, name } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginPage = location.pathname === '/login';
  const isHomePage = location.pathname === '/' || location.pathname === '';

  if (isLoginPage) return null;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.headerStart}>
          {!isHomePage && (
            <button onClick={() => navigate(-1)} className={styles.backBtn}>
              ← חזרה
            </button>
          )}
        </div>

        <div className={styles.headerCenter}>
          <span className={styles.headerLogo}>📖 רשימת אנ&quot;ש</span>
        </div>

        <div className={styles.headerEnd}>
          {token && (
            <>
              {name && <span className={styles.headerUser}>שלום {name}</span>}
              <button onClick={handleLogout} className={styles.btnGhost}>
                יציאה
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function HydrateFallback() {
    return null;
}

export default function App() {
  return (
    <AuthProvider>
      <AppHeader />
      <Outlet />
    </AuthProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className={styles.errorPage}>
      <h1>{message}</h1>
      <p className={styles.errorDetails}>{details}</p>
      {stack && (
        <pre className={styles.errorStack}>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
