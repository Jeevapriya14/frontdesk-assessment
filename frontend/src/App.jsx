import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import MainLayout from './layout/MainLayout.jsx';
import Dashboard from './pages/DashBoard.jsx';
import RequestsPage from './pages/Requests.jsx';
import Learned from './pages/Learned.jsx';
import CallerListener from './pages/CallerListener.jsx';
import AdminPanel from './pages/AdminPanel.jsx';

import Login from './pages/Login.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';

import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let mounted = true;
    axios.get('http://localhost:4000/health')
      .then(r => {
        if (!mounted) return;
        const time = r.data?.time ? new Date(r.data.time).toLocaleTimeString() : new Date().toLocaleTimeString();
        setStatus(`Backend: ${r.data?.status || 'ok'} @ ${time}`);
      })
      .catch(e => {
        if (!mounted) return;
        setStatus('Backend unreachable: ' + (e.message || e));
      });
    return () => { mounted = false; };
  }, []);

  // Root redirect helper component defined inline for simplicity
  function RequireRootRedirect() {
    const [user, setUser] = useState(undefined);

    useEffect(() => {
      const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u || null);
      });
      return unsub;
    }, []);

    if (user === undefined) {
      // still checking auth state
      return <div />; // tiny loading placeholder
    }
    return user ? <Navigate to="/admin" replace /> : <Navigate to="/login" replace />;
  }

  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Admin is protected */}
          <Route
            path="/admin/*"
            element={
              <PrivateRoute>
                <AdminPanel />
              </PrivateRoute>
            }
          />

          {/* caller, learned, requests, dashboard (kept for direct access) */}
          <Route path="/caller" element={<CallerListener />} />
          <Route path="/learned" element={<Learned />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* root redirect */}
          <Route path="/" element={<RequireRootRedirect />} />
        </Routes>

        {/* Floating status bar */}
        <div className="fixed bottom-4 right-4 bg-white/90 border rounded px-3 py-2 text-sm shadow">
          {status}
        </div>
      </MainLayout>
    </BrowserRouter>
  );
}
