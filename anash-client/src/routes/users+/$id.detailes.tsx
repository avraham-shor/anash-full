import { useParams } from "react-router";
import { useState, useEffect } from "react";
import type { User } from "../../models/user.ts";
import { Card } from "../../components/card.tsx";
import { useAuth } from "../../context/auth.tsx";

export default function UserDetails() {
  const [user, setUser] = useState<User | null>(null);
  const { token, isAdmin } = useAuth();
  const base = import.meta.env.VITE_BASE_URL;
  const { id } = useParams();
  useEffect(() => {
    fetch(`${base}/${id}?isAdmin=${isAdmin}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        console.log("user data", data);
        setUser(data);
      });
  }, [id]);

  return (
    user ? <Card item={user} isAdmin={isAdmin} token={token} /> : <h1>loading...</h1>
  );
}
