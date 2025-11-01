import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import CallerListener from './pages/CallerListener';
import AdminPanel from './pages/AdminPanel'; // keep this if you have AdminPanel.jsx

export default function App() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    axios.get('http://localhost:4000/health')
      .then(r => setStatus(`Backend: ${r.data.status} at ${new Date(r.data.time).toLocaleTimeString()}`))
      .catch(e => setStatus('Backend unreachable: ' + (e.message || e)));
  }, []);

  return (
    <BrowserRouter>
      <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Frontdesk Demo</h1>
          <nav>
            <Link style={{ marginRight: 12 }} to="/">Home</Link>
            <Link style={{ marginRight: 12 }} to="/admin">Supervisor</Link>
            <span style={{ color: '#666' }}>{status}</span>
          </nav>
        </header>

        <main style={{ marginTop: 24 }}>
          <Routes>
            <Route path="/" element={
              <div>
                <h2>Quick links</h2>
                <p>To open a caller page paste a request id into this URL:</p>
                <pre style={{ background: '#111', color: '#fff', padding: 8 }}>http://localhost:5173/caller?id=&lt;REQUEST_ID&gt;</pre>
                <p>Supervisor UI: <Link to="/admin">Open Supervisor</Link></p>
              </div>
            } />
            <Route path="/caller" element={<CallerListener />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
