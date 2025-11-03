import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig'; // adjust path if needed

// Helper: pick a reasonable TTS voice
function choose_preferred_voice() {
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  // Prefer India/English India, then any English, then first voice
  return voices.find(v => /India|en-IN|English India|Google UK English/ig.test(v.name)) ||
         voices.find(v => /en-|English/ig.test(v.lang || v.name)) ||
         voices[0];
}

// Use browser TTS
function speakTextClient(text, opts = {}) {
  if (!text || !text.trim()) return;
  if (!('speechSynthesis' in window)) {
    console.log('speechSynthesis not available, fallback logging:', text);
    return;
  }

  const sanitized = text.replace(/<[^>]+>/g, '');
  const speakNow = () => {
    const ut = new SpeechSynthesisUtterance(sanitized);
    ut.lang = opts.lang || 'en-US';
    ut.rate = typeof opts.rate === 'number' ? opts.rate : 0.95;
    ut.pitch = typeof opts.pitch === 'number' ? opts.pitch : 1;
    ut.volume = typeof opts.volume === 'number' ? opts.volume : 1;

    const voice = choose_preferred_voice();
    if (voice) ut.voice = voice;

    try {
      window.speechSynthesis.cancel(); // stop any previous
      window.speechSynthesis.speak(ut);
    } catch (e) {
      console.error('speak error', e);
    }
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) {
    speakNow();
  } else {
    // wait for voices to load
    const onvoices = () => {
      try { speakNow(); } catch (e) { console.error(e); }
      window.speechSynthesis.onvoiceschanged = null;
    };
    window.speechSynthesis.onvoiceschanged = onvoices;
    setTimeout(() => {
      if (!window.speechSynthesis.speaking) speakNow();
    }, 1200);
  }
}

// Helper to convert base64->Blob
function base64ToBlob(base64, mime = 'audio/mpeg') {
  const binary = atob(base64);
  const len = binary.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function CallerListener() {
  const [params] = useSearchParams();
  const requestId = params.get('id');
  const [request, setRequest] = useState(null);
  const seen = useRef(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null); // HTMLAudioElement

  useEffect(() => {
    console.log('CallerListener mount, requestId=', requestId);
    if (!requestId) return;

    const ref = doc(db, 'help_requests', requestId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        console.log('Caller doc missing');
        setRequest(null);
        return;
      }
      const data = snap.data();
      setRequest({ id: snap.id, ...data });
      console.log('CallerListener snapshot', snap.id, data.status);

      // speak when resolved and there's an answer
      if (data.status === 'RESOLVED' && data.answer_text) {
        const key = `${snap.id}::${data.answered_at || ''}`;
        if (!seen.current.has(key)) {
          seen.current.add(key);
          console.log('Will speak answer:', data.answer_text);

          // Prefer server TTS if provided on the doc
          const hasServerTtsBase64 = !!(data.tts && data.tts.base64);
          const hasServerTtsUrl = !!data.tts_url;

          if (audioUnlocked) {
            // if server TTS available, play it (base64 or URL)
            if (hasServerTtsBase64) {
              const blob = base64ToBlob(data.tts.base64, data.tts.mime || 'audio/mpeg');
              playBlobAudio(blob);
            } else if (hasServerTtsUrl) {
              playUrlAudio(data.tts_url);
            } else {
              // no server audio -> use client speechSynthesis
              setTimeout(() => speakTextClient(data.answer_text), 200);
            }
          } else {
            console.log('Audio not unlocked — user must click Enable audio or Play answer aloud');
          }
        }
      }
    }, (err) => {
      console.error('CallerListener onSnapshot error', err);
    });

    return () => {
      console.log('CallerListener unmount');
      unsub();
      stopPlaying();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, audioUnlocked]);

  // user gesture to "unlock" audio autoplay policies in some browsers
  function unlockAudio() {
    try {
      // small user-gesture utterance; browsers treat this as a user gesture
      const u = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error('unlockAudio error', e);
    }
    setAudioUnlocked(true);

    // pre-load voices list (help choose_preferred_voice)
    setTimeout(() => {
      const v = window.speechSynthesis.getVoices();
      if (!v.length) {
        window.speechSynthesis.onvoiceschanged = () => {
          console.log('voices loaded after unlock', window.speechSynthesis.getVoices().map(x => x.name));
        };
      } else {
        console.log('voices already loaded', v.map(x => x.name));
      }
    }, 100);
  }

  function stopPlaying() {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setPlaying(false);
    }
  }

  // play a blob (server-provided base64 converted to blob or fetched)
  function playBlobAudio(blob) {
    stopPlaying();
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    audioRef.current = a;
    setPlaying(true);
    a.onended = () => {
      setPlaying(false);
      URL.revokeObjectURL(url);
    };
    a.onerror = (e) => {
      console.error('audio play error', e);
      setPlaying(false);
    };
    a.play().catch(err => {
      console.error('play() failed', err);
      setPlaying(false);
    });
  }

  async function playUrlAudio(url) {
    stopPlaying();
    const a = new Audio(url);
    audioRef.current = a;
    setPlaying(true);
    a.onended = () => setPlaying(false);
    a.onerror = (e) => {
      console.error('audio url play error', e);
      setPlaying(false);
    };
    try {
      await a.play();
    } catch (err) {
      console.error('audio play failed', err);
      setPlaying(false);
    }
  }

  // Fetch TTS for this request from server endpoint, then play
  async function fetchAndPlayTts() {
    if (!request?.id) return alert('No request selected');
    if (!audioUnlocked) return alert('Please click "Enable audio" first');

    try {
      const res = await fetch(`/api/requests/${request.id}/tts`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        console.warn('TTS endpoint responded:', res.status, body);
        return alert(body?.error || `TTS not available (status ${res.status})`);
      }
      // stream audio response and play
      const contentType = res.headers.get('content-type') || 'audio/mpeg';
      const arrayBuffer = await res.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: contentType });
      playBlobAudio(blob);
    } catch (err) {
      console.error('fetchAndPlayTts error', err);
      alert('Failed to fetch TTS audio. Check console.');
    }
  }

  // allow manual play: prefer server tts on doc, else client TTS
  function handlePlayAnswer() {
    if (!request) return;
    // if doc contains server-provided base64 or url, play that
    if (request.tts && request.tts.base64) {
      const blob = base64ToBlob(request.tts.base64, request.tts.mime || 'audio/mpeg');
      playBlobAudio(blob);
      return;
    }
    if (request.tts_url) {
      playUrlAudio(request.tts_url);
      return;
    }
    // fallback to client-side speech synthesis
    speakTextClient(request.answer_text);
  }

  // allow user to download server tts if present
  function handleDownload() {
    if (!request) return;
    if (request.tts && request.tts.base64) {
      const blob = base64ToBlob(request.tts.base64, request.tts.mime || 'audio/mpeg');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `answer-${request.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
    if (request.tts_url) {
      const a = document.createElement('a');
      a.href = request.tts_url;
      a.download = `answer-${request.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    alert('No server TTS available to download.');
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Caller — Request Listener</h2>

      {!requestId && (
        <div>
          Open <code>/caller?id=&lt;REQUEST_ID&gt;</code> (example:
          <code>/caller?id=f355e8be-6462-4723-afc2-885904f2e9e2</code>)
        </div>
      )}

      {!audioUnlocked && (
        <div style={{ margin: '12px 0' }}>
          <button
            onClick={unlockAudio}
            style={{
              background: '#f3f4f6', // light gray
              color: '#000000',      // black text
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontWeight: 600,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              cursor: 'pointer'
            }}
          >
            🔊 Enable audio (click once)
          </button>

          <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
            Modern browsers require a user gesture before audio can autoplay. Click once to enable.
          </div>
        </div>
      )}

      {requestId && !request && <div>Waiting for request (id: {requestId})…</div>}

      {request && (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8 }}><strong>Question:</strong> {request.question_text}</div>
          <div style={{ marginBottom: 8 }}><strong>Status:</strong> {request.status}</div>

          {request.status === 'RESOLVED' && (
            <>
              <div style={{ marginBottom: 12 }}><strong>Answer:</strong> {request.answer_text}</div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={handlePlayAnswer}
                  disabled={!audioUnlocked && !('speechSynthesis' in window)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  {playing ? 'Playing…' : 'Play answer aloud'}
                </button>

                <button
                  onClick={fetchAndPlayTts}
                  title="Ask server to generate/return TTS audio"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Fetch server TTS
                </button>

                <button
                  onClick={handleDownload}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Download audio
                </button>
              </div>

              {!audioUnlocked && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                  Note: click <strong>Enable audio</strong> to allow autoplay/streamed audio on this device.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
