require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, admin } = require('./src/firebase');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Optional imports for LiveKit / TTS helpers:
let AccessToken, RoomServiceGrant;
try {
  const livekit = require('livekit-server-sdk');
  AccessToken = livekit.AccessToken;
  RoomServiceGrant = livekit.RoomServiceGrant;
} catch (e) {
  // livekit-server-sdk optional; token endpoint will return 501 if not configured
}

let TextToSpeechClient;
try {
  const tts = require('@google-cloud/text-to-speech');
  TextToSpeechClient = tts.TextToSpeechClient;
} catch (e) {
  // google tts optional - createTtsAudio will throw if not available
}

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

/**
 * Create a request (existing)
 */
app.post('/api/requests', async (req, res) => {
  try {
    const { caller_id, question_text } = req.body;

    if (!question_text || question_text.trim() === '') {
      return res.status(400).json({ error: 'question_text is required' });
    }

    const id = uuidv4();
    const created_at = new Date().toISOString();

    const newRequest = {
      id,
      caller_id: caller_id || null,
      question_text: question_text.trim(),
      status: 'PENDING',
      created_at
    };

    await db.collection('help_requests').doc(id).set(newRequest);

    return res.status(201).json({
      message: 'Request created',
      request: newRequest
    });
  } catch (err) {
    console.error('Error creating request:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message || 'failed' });
  }
});

/**
 * List pending requests (existing)
 */
app.get('/api/requests', async (req, res) => {
  try {
    const snapshot = await db.collection('help_requests')
      .where('status', '==', 'PENDING')
      .orderBy('created_at')
      .get();
    const requests = snapshot.docs.map(d => d.data());
    res.json({ requests });
  } catch (err) {
    console.error('fetch requests error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

/**
 * Resolve a request (update status to RESOLVED).
 * This endpoint is used when supervisor answers a request.
 * Later we can extend it to generate TTS audio and inject/play into LiveKit room.
 */
app.put('/api/requests/:id/resolve', async (req, res) => {
  const id = req.params.id;
  const { answer_text, answered_by } = req.body;

  if (!answer_text || !answer_text.trim()) {
    return res.status(400).json({ error: 'answer_text is required' });
  }

  try {
    const docRef = db.collection('help_requests').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'request not found' });

    const update = {
      status: 'RESOLVED',
      answer_text: answer_text.trim(),
      answered_by: answered_by || 'supervisor',
      answered_at: new Date().toISOString()
    };

    await docRef.update(update);

    // Return the updated doc to client
    const updated = (await docRef.get()).data();
    res.json({ message: 'Request resolved', request: updated });
  } catch (err) {
    console.error('resolve error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

/**
 * Resolve and speak (skeleton)
 * - Updates Firestore
 * - Generates TTS audio buffer (if configured)
 * - (Not included) You must decide on how to publish this audio into LiveKit.
 *
 * Two options for audio playback:
 *  A) Server-side: create a headless participant (bot) that connects via WebRTC and publishes the audio track.
 *  B) Client-side: use the caller's browser to play the audio (easier) — send a Firestore update or message and let the client play local TTS.
 *
 * This endpoint implements the update + TTS generation (if Google TTS available)
 * and returns either an audio URL (if you upload it) or a base64 audio payload.
 */
app.put('/api/requests/:id/resolve-and-speak', async (req, res) => {
  const id = req.params.id;
  const { answer_text, answered_by, livekit_room } = req.body;

  if (!answer_text || !answer_text.trim()) {
    return res.status(400).json({ error: 'answer_text is required' });
  }

  try {
    // 1) update doc
    const docRef = db.collection('help_requests').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'request not found' });

    const update = {
      status: 'RESOLVED',
      answer_text: answer_text.trim(),
      answered_by: answered_by || 'supervisor',
      answered_at: new Date().toISOString(),
      // optionally store room info if provided
      livekit_room: livekit_room || null
    };
    await docRef.update(update);

    // 2) Generate TTS audio buffer (optional)
    let audio_base64 = null;
    try {
      if (!TextToSpeechClient) throw new Error('Google TTS library not installed or not configured');
      const audioBuffer = await createTtsAudio(answer_text);
      audio_base64 = audioBuffer.toString('base64');
      // NOTE: you probably want to upload the buffer to storage (GCS/S3) and return a URL
      // or pass buffer to a LiveKit publisher routine to play it into a room.
    } catch (ttsErr) {
      console.warn('TTS generation skipped/failed:', ttsErr && ttsErr.message ? ttsErr.message : ttsErr);
    }

    res.json({
      message: 'resolved',
      request: update,
      tts: audio_base64 ? { base64: audio_base64, mime: 'audio/mp3' } : null,
      note: 'To play audio into LiveKit room you must implement a publisher that consumes this audio (see docs).'
    });
  } catch (err) {
    console.error('resolve-and-speak error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

/**
 * LiveKit token endpoint (simple)
 * Requires LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env
 */
app.post('/api/livekit/token', (req, res) => {
  const { identity, room } = req.body || {};
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL || null;

  if (!apiKey || !apiSecret || !AccessToken || !RoomServiceGrant) {
    return res.status(501).json({ error: 'LiveKit not configured on server (LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing or sdk not installed).' });
  }
  if (!identity) return res.status(400).json({ error: 'identity required' });

  try {
    const at = new AccessToken(apiKey, apiSecret, { identity });
    if (room) {
      const grant = new RoomServiceGrant({ roomJoin: true, room });
      at.addGrant(grant);
    }
    // if RoomServiceGrant API differs on your SDK version, adapt accordingly.
    const token = at.toJwt();
    res.json({ token, url: livekitUrl });
  } catch (err) {
    console.error('livekit token error', err);
    res.status(500).json({ error: 'livekit token error' });
  }
});

/**
 * Helper: create TTS audio using Google Cloud Text-to-Speech.
 * Returns a Buffer (MP3) when successful.
 * Requires @google-cloud/text-to-speech and GOOGLE_APPLICATION_CREDENTIALS env var set.
 */
async function createTtsAudio(text, options = {}) {
  if (!TextToSpeechClient) throw new Error('TextToSpeechClient is not available (missing package).');
  const client = new TextToSpeechClient();

  const request = {
    input: { text },
    voice: { languageCode: 'en-US', ssmlGender: 'FEMALE' },
    audioConfig: { audioEncoding: 'MP3' }
  };

  const [response] = await client.synthesizeSpeech(request);
  // response.audioContent is a Buffer
  return response.audioContent;
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
