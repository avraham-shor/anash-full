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
  const [loadFailed, setLoadFailed] = useState(false);
  const { role, id: myId, pwVerified } = useAuth();
  const { id } = useParams();

  useEffect(() => {
    let cancelled = false;
    setUser(null);
    setLoadFailed(false);
    fetch(`${USERS_URL}${id}`, { credentials: 'include' })
      // Without the res.ok check an error body would be parsed as a record: it carries no
      // hasPassword, which the edit gate below reads, so the affordance would be offered anyway.
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(data => { if (!cancelled) setUser(data); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [id]);

  // An account that has a password can only be edited by a session that proved it — the server
  // rejects anything else. A passwordless account still edits through the OTP flow, so it is
  // offered the link even though pwVerified is false for it. `=== false` on purpose: the field is
  // absent from the admin full-row branch, and absence must not open the gate.
  const isOwnRecord = Boolean(myId) && myId === id;
  const canEdit = role === 'owner' || (isOwnRecord && (pwVerified || user?.hasPassword === false));
  // Their own record, they hold a password, but this session never proved it.
  const needsPasswordLogin = isOwnRecord && !pwVerified && user?.hasPassword === true;

  if (loadFailed) {
    return (
      <div className={styles.editBar}>
        <span>לא ניתן לטעון את הרשומה. נסה שוב מאוחר יותר.</span>
      </div>
    );
  }

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
        {needsPasswordLogin && (
          <div className={styles.editBar}>
            <span>כדי לערוך את הפרטים שלך, יש להתחבר מחדש עם הסיסמה שלך.</span>
          </div>
        )}
        <Card item={user} role={role} />
      </div>
    ) : <Loader />
  );
}
