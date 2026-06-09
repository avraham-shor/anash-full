import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigate,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import "./styles.css";
import { ButtonGoToMenu } from "./components/button-go-to-menu";
import { AuthProvider, useAuth } from "./context/auth";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>רשימת אנ"ש</title>
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

function LogoutButton() {
  const { token, logout, name } = useAuth();
  const navigate = useNavigate();

  if (!token) return null;


  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <button
        onClick={handleLogout}
        style={{
          position: 'fixed',
          top: '12px',
          left: '12px',
          padding: '6px 14px',
          border: '2px solid var(--border)',
          borderRadius: '4px',
          background: 'var(--bg2)',
          color: 'var(--text-h)',
          cursor: 'pointer',
          fontSize: '14px',
          zIndex: 1000,
        }}
      >
        יציאה
      </button>
      <div
        style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          padding: '6px 14px',
          border: '2px solid var(--border)',
          borderRadius: '4px',
          background: 'var(--bg2)',
          color: 'var(--text-h)',
          cursor: 'pointer',
          fontSize: '14px',
          zIndex: 1000,
        }}
      >
        שלום {name || ''}
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LogoutButton />
      <ButtonGoToMenu />
      <Outlet />
    </AuthProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    console.log(error)
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
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
