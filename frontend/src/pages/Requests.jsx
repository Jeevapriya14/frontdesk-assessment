import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import RequestCard from '../components/RequestCard';

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/requests');
      const data = res.data;
     
      if (Array.isArray(data)) setRequests(data);
      else if (data && Array.isArray(data.requests)) setRequests(data.requests);
      else setRequests([]);
    } catch (e) {
      console.error('Failed to load requests', e);
      if (window.showToast) window.showToast('Failed to load requests', 3500, 'error');
      setRequests([]);
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
    if (!selected || !answerText.trim()) {
      if (window.showToast) window.showToast('Answer text required', 2500, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { answer_text: answerText.trim(), answered_by: 'supervisor' };
   
      await api.put(`/api/requests/${selected.id}/resolve-and-speak`, payload);

     
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const speak = () => {
            const u = new SpeechSynthesisUtterance(answerText.trim());
            u.lang = 'en-US';
            const voices = window.speechSynthesis.getVoices();
            if (voices && voices.length) {
              const candidate = voices.find(v => /en|US|UK/i.test(v.lang)) || voices[0];
              if (candidate) u.voice = candidate;
            }
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
          };
          if (window.speechSynthesis.getVoices().length) speak();
          else setTimeout(speak, 150);
        }
      } catch (s) {
        console.warn('browser speak failed', s);
      }

      if (window.showToast) window.showToast('Answer sent successfully!', 3000, 'success');

    
      setSelected(null);
      setAnswerText('');
      await load();
    } catch (e) {
      console.error('submitAnswer error', e);
      if (window.showToast) window.showToast('Failed to send answer', 3500, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const archiveRequest = async (request) => {
    try {
      await api.put(`/api/requests/${request.id}/archive`);
      if (window.showToast) window.showToast('Archived', 2000, 'success');
      await load();
    } catch (e) {
      console.error('archive error', e);
      if (window.showToast) window.showToast('Failed to archive', 3000, 'error');
    }
  };

  
  const handleCardResolved = async (id) => {
    await load();
  };
  const handleCardArchived = async (id) => {
    await load();
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!requests.length) return <div className="p-6">No requests found</div>;

  return (
    <div className="p-6">
      <div className="grid gap-4">
        {requests.map(r => (
          <RequestCard
            key={r.id}
            request={r}
            onResolved={() => handleCardResolved(r.id)}
            onArchived={() => handleCardArchived(r.id)}
            onResolve={handleResolve}
            onArchive={archiveRequest}
          />
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
            placeholder="Type answer to speak & resolve..."
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setSelected(null); setAnswerText(''); }}
              className="px-3 py-1 border rounded"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={submitAnswer}
              className="px-3 py-1 bg-indigo-600 text-white rounded"
              disabled={submitting}
            >
              {submitting ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
