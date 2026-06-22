import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useAuth } from '../context/auth.tsx';

export default function ProtectedLayout() {
    const { isLoggedIn, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !isLoggedIn) {
            navigate('/login', { replace: true });
        }
    }, [isLoggedIn, loading, navigate]);

    if (loading || !isLoggedIn) return null;

    return <Outlet />;
}
