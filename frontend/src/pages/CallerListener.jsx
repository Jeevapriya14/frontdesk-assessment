import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig'; // file lives at src/firebaseConfig.js

function choose_preferred_voice() {
  const voices = window.speechSynthesis.getVoices() || [];
  // try to prefer an Indian / English voice, otherwise pick a first English-like or default
  const prefer = voices.find(v => /India|English India|en-IN|Google UK English/ig.test(v.name)) ||
                 voices.find(v => /English/ig.test(v.lang || v.name)) ||
                 voices[0];
  return prefer || null;
}

function speakText(text) {
  if (!text || !text.trim()) return;
  const s = text.replace(/<[^>]*>/g, '');
  if (!('speechSynthesis' in window)) {
    console.log('Simulated speak:', s);
    return;
  }

  const speakNow = () => {
    const ut = new SpeechSynthesisUtterance(s);
    ut.lang = 'en-US';           // reasonable default; change to 'en-IN' if you prefer
    ut.rate = 0.95;              // slightly slower for clarity
    ut.pitch = 1;
    ut.volume = 1;

    const voice = choose_preferred_voice();
    if (voice) ut.voice = voice;

    try {
      window.speechSynthesis.speak(ut);
    } catch (e) {
      console.error('speak error', e);
    }
  };

  // voices may not be loaded yet — handle both cases
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) {
    speakNow();
  } else {
    // wait for voices to load, then speak once
    const cb = () => {
      try { speakNow(); } catch(e) { console.error(e); }
      window.speechSynthesis.onvoiceschanged = null;
    };
    window.speechSynthesis.onvoiceschanged = cb;
    // also set a short fallback timer
    setTimeout(() => {
      if (!window.speechSynthesis.speaking) speakNow();
    }, 1200);
  }
}

export default function CallerListener() {
  const [params] = useSearchParams();
  const requestId = params.get('id');
  const [request, setRequest] = useState(null);
  const seen = useRef(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState(false);

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

      // only speak when resolved and there's an answer_text
      if (data.status === 'RESOLVED' && data.answer_text) {
        const key = `${snap.id}::${data.answered_at || ''}`;
        if (!seen.current.has(key)) {
          seen.current.add(key);
          console.log('Will speak answer:', data.answer_text);
          // If audio is not unlocked, we still log and store; user can press Play
          if (audioUnlocked) {
            // Slight delay so UI updates show before audio starts
            setTimeout(() => speakText(data.answer_text), 200);
          } else {
            console.log('Audio not unlocked — click "Enable audio" or "Play answer aloud" to hear it.');
          }
        }
      }
    }, (err) => {
      console.error('CallerListener onSnapshot error', err);
    });

    return () => {
      console.log('CallerListener unmount');
      unsub();
    };
  }, [requestId, audioUnlocked]);

  // user gesture to "unlock" audio autoplay policies in some browsers
  function unlockAudio() {
    try {
      // speak an empty utterance to register a user gesture
      const u = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error('unlockAudio error', e);
    }
    setAudioUnlocked(true);
    // pre-load voices list
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

  return (
    <div style={{ padding: 20 }}>
      <h2>Caller — Request Listener</h2>

      {!requestId && <div>Open <code>/caller?id=&lt;REQUEST_ID&gt;</code> (example: <code>/caller?id=f355e8be-...</code>)</div>}

      {/* enable audio button for user gesture */}
      {!audioUnlocked && (
        <div style={{ margin: '12px 0' }}>
          <button onClick={unlockAudio}>Enable audio (click once)</button>
        </div>
      )}

      {requestId && !request && <div>Waiting for request (id: {requestId})…</div>}

      {request && (
        <div>
          <div style={{ marginBottom: 8 }}><strong>Question:</strong> {request.question_text}</div>
          <div style={{ marginBottom: 8 }}><strong>Status:</strong> {request.status}</div>

          {request.status === 'RESOLVED' && (
            <>
              <div style={{ marginBottom: 12 }}><strong>Answer:</strong> {request.answer_text}</div>

              {/* manual play button for testing (user gesture) */}
              <div style={{ marginTop: 8 }}>
                <button onClick={() => speakText(request.answer_text)}>Play answer aloud</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
