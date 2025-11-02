import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await signOut(auth);
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Sign-out error', err);
    }
  }

  return (
    <header className="flex justify-between items-center bg-white px-6 py-3 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-800">Frontdesk Admin</h1>

      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-600">{auth.currentUser?.email}</span>
        <button
          onClick={handleSignOut}
          className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
