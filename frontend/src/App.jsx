import { useEffect, useState } from 'react';
import axios from 'axios';

export default function App() {
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    axios.get('http://localhost:4000/health')
      .then(r => setStatus(`Backend: ${r.data.status} at ${new Date(r.data.time).toLocaleTimeString()}`))
      .catch(e => setStatus('Backend unreachable: ' + e.message));
  }, []);
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Frontdesk Demo — Frontend</h1>
      <p>{status}</p>
      <p>Next: we’ll wire LiveKit and show a caller page + supervisor UI.</p>
    </div>
  );
}
