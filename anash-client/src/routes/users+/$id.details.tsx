import { useParams } from 'react-router';
import { useState, useEffect } from 'react';
import type { User } from '../../models/user.ts';
import { Card } from '../../components/card.tsx';
import { useAuth } from '../../context/auth.tsx';
import { USERS_URL } from '../../config';

export default function UserDetails() {
  const [user, setUser] = useState<User | null>(null);
  const { token, role } = useAuth();
  const { id } = useParams();
  useEffect(() => {
    fetch(`${USERS_URL}${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        setUser(data);
      });
  }, [id]);

  return (
    user ? <Card item={user} role={role} token={token} /> : <h1>loading...</h1>
  );
}
