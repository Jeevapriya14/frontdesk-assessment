import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function Learned() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get('/api/learned').then(r => setItems(r.data || [])).catch(err => {
      console.error(err);
      setItems([]);
    });
  }, []);
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Learned Answers</h2>
      {!items.length && <div className="text-gray-500">No learned answers yet.</div>}
      <div className="space-y-2 mt-3">
        {items.map(i => (
          <div key={i.id} className="bg-white p-3 rounded border">
            <div className="font-medium">{i.question}</div>
            <div className="text-sm text-gray-700 mt-1">{i.answer}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
