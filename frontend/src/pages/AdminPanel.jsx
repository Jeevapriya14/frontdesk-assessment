// frontend/src/pages/AdminPanel.jsx
import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import AdminLogin from '../components/AdminLogin';
import { api } from '../utils/api';

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [sending, setSending] = useState(false);

  // Auth listener + admin claim check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        return;
      }
      try {
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

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setRequests(data);
      },
      (err) => console.error('onSnapshot error', err)
    );

    return () => unsubscribe();
  }, [isAdmin]);

  async function submitAnswer() {
    if (!selected || !answerText.trim()) return;
    setSending(true);
    try {
      await api.put(`/api/requests/${selected.id}/resolve`, {
        answer_text: answerText,
        answered_by: 'supervisor',
      });

      // Optimistically remove answered request from list
      setRequests((prev) => prev.filter((r) => r.id !== selected.id));
      setSelected(null);
      setAnswerText('');
    } catch (e) {
      console.error('submitAnswer error', e);
      alert('Failed to send answer. Check console.');
    } finally {
      setSending(false);
    }
  }

  if (!user || !isAdmin) {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto">
          <AdminLogin onSignedIn={() => {}} />
          <div className="mt-3 text-sm text-gray-600">
            Note: this account must have the{' '}
            <code className="bg-gray-100 px-1 rounded">admin</code> custom claim.
            If you just set the claim, sign out and sign back in.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          Supervisor — Pending Requests (Real-Time)
        </h2>
        <div className="text-sm text-gray-600">{user.email}</div>
      </div>

      {requests.length === 0 && (
        <div className="text-gray-500">No pending requests</div>
      )}

      <div className="space-y-3">
        {requests.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded border p-4 flex justify-between items-start"
          >
            <div>
              <div className="text-sm text-gray-500">
                From: {r.caller_id || 'unknown'}
              </div>
              <div className="font-medium text-gray-800 mt-1">
                {r.question_text}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Created:{' '}
                {r.created_at
                  ? new Date(r.created_at).toLocaleString()
                  : '-'}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setSelected(r);
                  setAnswerText('');
                }}
                className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
              >
                Answer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating answer panel */}
      {selected && (
        <div className="fixed right-6 bottom-16 w-96 bg-white/95 backdrop-blur border rounded-2xl shadow-lg p-4 z-50">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-gray-500">Answering</div>
              <div className="font-medium text-gray-800">
                {selected.question_text}
              </div>
            </div>
            <button
              onClick={() => {
                setSelected(null);
                setAnswerText('');
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <textarea
            rows="5"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            className="w-full border rounded p-2 mt-3"
            placeholder="Type your answer here..."
          />

          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => {
                setSelected(null);
                setAnswerText('');
              }}
              className="px-3 py-1 border rounded"
            >
              Cancel
            </button>
            <button
              onClick={submitAnswer}
              disabled={sending || !answerText.trim()}
              className={`px-3 py-1 rounded text-white ${
                sending || !answerText.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
