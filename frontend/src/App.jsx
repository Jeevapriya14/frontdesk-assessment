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
import Toast from './components/Toast.jsx';

import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
       
        window.speechSynthesis.getVoices();
      } catch (e) {
       
      }
    }

  
    if (typeof window !== 'undefined' && !window.showToast) {
      window.showToast = function (text = '', duration = 3500, variant = 'info') {
        try {
          const id = `toast-${Date.now()}`;
          const el = document.createElement('div');
          el.id = id;
          el.textContent = text;
          el.style.position = 'fixed';
          el.style.top = '16px';
          el.style.right = '16px';
          el.style.zIndex = 9999;
          el.style.background = variant === 'error' ? 'rgba(185,28,28,0.95)' : variant === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(0,0,0,0.85)';
          el.style.color = 'white';
          el.style.padding = '8px 12px';
          el.style.borderRadius = '10px';
          el.style.fontSize = '13px';
          el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
          el.style.pointerEvents = 'auto';
          document.body.appendChild(el);
          setTimeout(() => {
            try { el.remove(); } catch {}
          }, duration);
        } catch (e) {
         
        }
      };
    }

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

  
    axios.get('http://localhost:4000/api/config')
      .then(r => {
        if (!mounted) return;
        const cfg = r.data || {};
        setStatus(prev => {
          const cfgText = `LiveKit: ${cfg.livekit ? 'OK' : 'Not configured'} • TTS: ${cfg.tts ? 'OK' : 'Not configured'}`;
          return prev && prev !== 'loading' ? `${prev}  • ${cfgText}` : cfgText;
        });
      })
      .catch(() => {
    
      });

    return () => { mounted = false; };
  }, []);

 
  function RequireRootRedirect() {
    const [user, setUser] = useState(undefined);

    useEffect(() => {
      const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u || null);
      });
      return unsub;
    }, []);

    if (user === undefined) {
      
      return <div />;
    }
    return user ? <Navigate to="/admin" replace /> : <Navigate to="/login" replace />;
  }

  return (
    <BrowserRouter>
     
      <Toast />

      <MainLayout>
        <Routes>
          <Route path="/login" element={<Login />} />

      
          <Route
            path="/admin/*"
            element={
              <PrivateRoute>
                <AdminPanel />
              </PrivateRoute>
            }
          />

      
          <Route path="/caller" element={<CallerListener />} />
          <Route path="/learned" element={<Learned />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/dashboard" element={<Dashboard />} />

        
          <Route path="/" element={<RequireRootRedirect />} />
        </Routes>

      
        <div className="fixed bottom-4 right-4 bg-white/90 border rounded px-3 py-2 text-sm shadow">
          {status}
        </div>
      </MainLayout>
    </BrowserRouter>
  );
}
