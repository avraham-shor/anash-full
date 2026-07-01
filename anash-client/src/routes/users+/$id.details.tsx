import { useParams, Link } from 'react-router';
import { useState, useEffect } from 'react';
import type { User } from '../../models/user.ts';
import { Card } from '../../components/card.tsx';
import { useAuth } from '../../context/auth.tsx';
import { USERS_URL } from '../../config';
import { Loader } from '../../components/loader.tsx';
import styles from './$id.details.module.css';

export default function UserDetails() {
  const [user, setUser] = useState<User | null>(null);
  const { role, id: myId } = useAuth();
  const { id } = useParams();
  useEffect(() => {
    fetch(`${USERS_URL}${id}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setUser(data);
      });
  }, [id]);

  const canEdit = myId === id || role === 'owner';

  return (
    user ? (
      <div>
        {canEdit && (
          <div className={styles.editBar}>
            <Link to={`/users/${id}/edit`} className={styles.editBtn}>
              ✏️ ערוך פרטים
            </Link>
          </div>
        )}
        <Card item={user} role={role} />
      </div>
    ) : <Loader />
  );
}
