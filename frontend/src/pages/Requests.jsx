import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import RequestCard from '../components/RequestCard';

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [answerText, setAnswerText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/requests');
      setRequests(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleResolve = (request) => {
    setSelected(request);
    setAnswerText('');
  };

  const submitAnswer = async () => {
    if (!selected || !answerText.trim()) return;
    try {
      await api.put(`/api/requests/${selected.id}/resolve`, {
        answer_text: answerText,
        answered_by: 'supervisor'
      });
      setSelected(null);
      setAnswerText('');
      // refresh
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const archiveRequest = async (request) => {
    try {
      await api.put(`/api/requests/${request.id}/archive`);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!requests.length) return <div>No requests found</div>;

  return (
    <div>
      <div className="grid gap-4">
        {requests.map(r => (
          <RequestCard key={r.id} request={r} onResolve={handleResolve} onArchive={archiveRequest} />
        ))}
      </div>

      {selected && (
        <div className="fixed bottom-16 right-6 bg-white/95 backdrop-blur border rounded-2xl shadow-lg p-4 w-80">
          <h4 className="font-semibold mb-2">Answer: {selected.question_text}</h4>
          <textarea
            rows="4"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            className="w-full border rounded p-2"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => { setSelected(null); setAnswerText(''); }} className="px-3 py-1 border rounded">Cancel</button>
            <button onClick={submitAnswer} className="px-3 py-1 bg-indigo-600 text-white rounded">Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
