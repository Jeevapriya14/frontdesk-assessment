
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';

export default function RequestCard({ request, onArchived, onResolved }) {
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [loadingResolve, setLoadingResolve] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [serverAudioUrl, setServerAudioUrl] = useState(null);
  const audioRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current && audioRef.current.src) {
        try { URL.revokeObjectURL(audioRef.current.src); } catch {}
      }
      if (serverAudioUrl) {
        try { URL.revokeObjectURL(serverAudioUrl); } catch {}
      }
    };
   
  }, []);

  if (!request) return null;
  const { id, question_text, caller_id, created_at } = request;

  async function handleArchive() {
    if (!id) return;
    setLoadingArchive(true);
    try {
      await api.put(`/api/requests/${id}/archive`);
      if (typeof onArchived === 'function') onArchived(id);
      if (window.showToast) window.showToast('Archived request');
    } catch (err) {
      console.error('archive error', err);
      if (window.showToast) window.showToast('Failed to archive', 3000);
    } finally {
      setLoadingArchive(false);
    }
  }

  function playAudioFromBase64(base64, mime = 'audio/mpeg') {
    try {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes.buffer], { type: mime });
      const url = URL.createObjectURL(blob);
      setServerAudioUrl(url);
      setSpeaking(true);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(e => { console.warn('audio play failed', e); setSpeaking(false); });
      audio.onended = () => setSpeaking(false);
    } catch (e) {
      console.warn('failed to play base64 audio', e);
      if (window.showToast) window.showToast('Failed to play audio', 3000);
    }
  }

  function playAudioFromUrl(url) {
    try {
      setServerAudioUrl(url);
      const audio = new Audio(url);
      audioRef.current = audio;
      setSpeaking(true);
      audio.play().catch(e => { console.warn('audio play failed', e); setSpeaking(false); });
      audio.onended = () => setSpeaking(false);
    } catch (e) {
      console.warn('failed to play audio url', e);
      if (window.showToast) window.showToast('Failed to play audio', 3000);
    }
  }

  function speakWithBrowser(text) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (window.showToast) window.showToast('Browser speech not supported', 3000);
      return;
    }
    const speak = () => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length) {
          const candidate = voices.find(v => /en|US|UK/i.test(v.lang)) || voices[0];
          if (candidate) u.voice = candidate;
        }
        window.speechSynthesis.cancel();
        setSpeaking(true);
        window.speechSynthesis.speak(u);
        u.onend = () => setSpeaking(false);
        u.onerror = () => { setSpeaking(false); if (window.showToast) window.showToast('Speech failed', 3000); };
      } catch (e) {
        console.warn('SpeechSynthesis error', e);
        if (window.showToast) window.showToast('Speech error', 3000);
      }
    };
    const voicesNow = window.speechSynthesis.getVoices();
    if (!voicesNow || !voicesNow.length) setTimeout(speak, 150);
    else speak();
  }

  async function submitAnswer() {
    if (!answerText.trim()) {
      if (window.showToast) window.showToast('Enter answer text', 2500);
      return;
    }
    setLoadingResolve(true);
    try {
      const payload = { answer_text: answerText.trim(), answered_by: 'supervisor@ui' };
      const res = await api.put(`/api/requests/${id}/resolve-and-speak`, payload);

      
      const tts_url = res?.data?.tts_url || (res?.data?.tts && res.data.tts.url) || null;
      const tts_base64 = res?.data?.tts?.base64 || (res?.data?.tts && res.data.tts.base64) || null;
      const server_tts_mime = res?.data?.tts?.mime || 'audio/mpeg';

      if (tts_url) {
        playAudioFromUrl(tts_url);
        if (window.showToast) window.showToast('Played server audio', 2500);
      } else if (tts_base64) {
        playAudioFromBase64(tts_base64, server_tts_mime);
        if (window.showToast) window.showToast('Played server audio', 2500);
      } else {
        speakWithBrowser(answerText.trim());
        if (window.showToast) window.showToast('Spoken locally in browser', 2500);
      }

      if (typeof onResolved === 'function') onResolved(id);

      setModalOpen(false);
      setAnswerText('');
    } catch (err) {
      console.error('submitAnswer error', err);
      if (window.showToast) window.showToast('Failed to send answer', 3000);
    } finally {
      setLoadingResolve(false);
    }
  }

  return (
    <>
      <div className="bg-white p-3 rounded border shadow-sm flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500 mb-1">
            {caller_id ? `Caller: ${caller_id}` : ''}
            {created_at ? ` • ${new Date(created_at).toLocaleString()}` : ''}
          </div>
          <div className="font-medium">{question_text}</div>

          {serverAudioUrl && (
            <div className="mt-2">
              <audio controls src={serverAudioUrl} className="w-full" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setModalOpen(true); setAnswerText(''); setTimeout(()=>textareaRef.current?.focus(), 120); }}
            disabled={loadingResolve || speaking}
            className="px-3 py-1 bg-green-600 text-white rounded"
          >
            {loadingResolve ? 'Resolving…' : speaking ? 'Speaking…' : 'Resolve'}
          </button>

          <button
            onClick={handleArchive}
            disabled={loadingArchive}
            className="px-3 py-1 bg-gray-500 text-white rounded"
          >
            {loadingArchive ? 'Archiving…' : 'Archive'}
          </button>
        </div>
      </div>

    
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />

          <div className="relative bg-white rounded-t-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 w-full max-w-md m-4">
            <h3 className="text-lg font-semibold mb-2">Answer</h3>
            <div className="text-sm text-gray-600 mb-3">{question_text}</div>

            <textarea
              ref={textareaRef}
              rows={5}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              className="w-full border rounded p-2 mb-3 focus:outline-none focus:ring"
              placeholder="Type answer to speak & resolve..."
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setModalOpen(false); setAnswerText(''); }}
                className="px-3 py-1 border rounded"
                disabled={loadingResolve}
              >
                Cancel
              </button>

              <button
                onClick={submitAnswer}
                className="px-3 py-1 bg-indigo-600 text-white rounded"
                disabled={loadingResolve}
              >
                {loadingResolve ? 'Sending…' : 'Send & Speak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
