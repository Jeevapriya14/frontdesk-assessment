
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export default function AdminLogin({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      onSignedIn && onSignedIn(userCred.user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 360, padding: 20 }}>
      <h3>Supervisor Sign In</h3>
      {err && <div style={{ color: 'red' }}>{err}</div>}
      <div style={{ marginBottom: 8 }}>
        <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
