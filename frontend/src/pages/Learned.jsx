
import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function Learned() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchKnowledge();
  }, []);

  async function fetchKnowledge() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/knowledge');
      const knowledge = (res.data && res.data.knowledge) ? res.data.knowledge : [];
      setItems(knowledge);
    } catch (err) {
      console.error('Failed to load knowledge:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to fetch');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Learned Answers</h2>
        <button
          onClick={fetchKnowledge}
          className="px-3 py-1 bg-indigo-600 text-white rounded"
        >
          Refresh
        </button>
      </div>

      {loading && <div className="text-gray-500">Loading…</div>}
      {error && <div className="text-red-600">Error: {error}</div>}

      {!loading && !items.length && !error && (
        <div className="text-gray-500">No learned answers yet.</div>
      )}

      <div className="space-y-3 mt-3">
        {items.map((i) => (
          <div key={i.id} className="bg-white p-3 rounded border shadow-sm">
            <div className="text-sm text-gray-500 mb-1">
              {i.created_by ? `By ${i.created_by}` : ''} {i.created_at ? `• ${new Date(i.created_at).toLocaleString()}` : ''}
            </div>
            <div className="font-medium">{i.question_text}</div>
            <div className="text-gray-700 mt-1">{i.answer_text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
