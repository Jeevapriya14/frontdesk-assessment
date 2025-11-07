import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function Dashboard() {
  const [counts, setCounts] = useState({ pending: 0, answered: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);

  async function loadCounts() {
    try {
      setLoading(true);
      const res = await api.get('/api/requests');
      const items = res.data || [];
      const pending = items.filter(i => (i.status || '').toUpperCase() === 'PENDING').length;
      const answered = items.filter(i => (i.status || '').toUpperCase() === 'ANSWERED' || (i.status || '').toUpperCase() === 'RESOLVED').length;
      setCounts({ pending, answered, resolved: items.length - pending });
    } catch (e) {
      console.error('Dashboard load error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCounts();
    const id = setInterval(loadCounts, 8000); 
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Pending Requests</div>
          <div className="text-3xl font-bold">{loading ? '—' : counts.pending}</div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Answered / Resolved</div>
          <div className="text-3xl font-bold">{loading ? '—' : counts.answered}</div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Total Requests</div>
          <div className="text-3xl font-bold">{loading ? '—' : counts.resolved + counts.pending}</div>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={loadCounts}
          className="px-3 py-2 bg-indigo-600 text-white rounded"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
