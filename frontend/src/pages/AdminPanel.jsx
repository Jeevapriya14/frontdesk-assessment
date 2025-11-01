// frontend/src/pages/AdminPanel.jsx
import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, getIdTokenResult, signOut } from 'firebase/auth';
import AdminLogin from '../components/AdminLogin';

function AdminPanel() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [answerText, setAnswerText] = useState('');

  // Auth listener + admin claim check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        return;
      }
      try {
        // force refresh token so latest custom claims are present
        const idTokenResult = await getIdTokenResult(u, true);
        setIsAdmin(!!(idTokenResult.claims && idTokenResult.claims.admin));
      } catch (err) {
        console.error('getIdTokenResult error', err);
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  // Firestore real-time listener (only start if admin)
  useEffect(() => {
    if (!isAdmin) {
      setRequests([]);
      return;
    }

    const q = query(
      collection(db, 'help_requests'),
      where('status', '==', 'PENDING'),
      orderBy('created_at', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
    }, (err) => {
      console.error('onSnapshot error', err);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  async function submitAnswer() {
    if (!selected || !answerText.trim()) return;
    try {
      await fetch(`http://localhost:4000/api/requests/${selected.id}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer_text: answerText, answered_by: 'supervisor' })
      });
      setSelected(null);
      setAnswerText('');
    } catch (e) {
      console.error(e);
    }
  }

  if (!user || !isAdmin) {
    // show login if not signed in, or not admin
    return (
      <div style={{ padding: 20 }}>
        <AdminLogin onSignedIn={() => { /* onAuthStateChanged will update UI */ }} />
        <div style={{ marginTop: 12 }}>
          <small>
            Note: this account must have the <code>admin</code> custom claim. If you just set the claim, sign out and sign back in.
          </small>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Supervisor — Pending Requests (Real-Time)</h2>
        <div>
          <span style={{ marginRight: 8 }}>{user.email}</span>
          <button onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </div>

      {requests.length === 0 && <div>No pending requests</div>}
      {requests.map(r => (
        <div key={r.id} style={{ border: '1px solid #ccc', marginBottom: 10, padding: 10 }}>
          <div><b>{r.question_text}</b></div>
          <div style={{ fontSize: 12 }}>From: {r.caller_id || 'unknown'}</div>
          <button onClick={() => setSelected(r)}>Answer</button>
        </div>
      ))}

      {selected && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: '#fff', padding: 15, border: '1px solid #ccc' }}>
          <h4>Answer</h4>
          <textarea
            rows="5"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            style={{ width: '100%' }}
          />
          <div>
            <button onClick={submitAnswer}>Send</button>
            <button onClick={() => setSelected(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
