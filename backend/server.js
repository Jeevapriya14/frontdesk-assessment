// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const roomsRoutes = require('./src/routes/rooms');
const bookingsRoutes = require('./src/routes/bookings');
const { generateToken, LIVEKIT_URL } = require('./src/livekit');
const { db, admin } = require('./src/firebase'); // ensure this exports { db, admin }

const pino = require('pino')();
const app = express();

app.use(cors({
  origin: [
    'https://ai-receiptionist-app.vercel.app',
    'http://localhost:5173'
    
  ],
  credentials: true
}));
app.use(express.json()); // JSON body parser

// attach a request-scoped logger
app.use((req, res, next) => {
  req.log = pino.child({ reqId: Date.now(), path: req.path, method: req.method });
  next();
});

// Mount API routes (after body parser & CORS)
app.use('/api', roomsRoutes);
app.use('/api', bookingsRoutes);
// Optional imports for LiveKit / TTS helpers:
let AccessToken, RoomServiceGrant;
try {
  const livekit = require('livekit-server-sdk');
  AccessToken = livekit.AccessToken;
  RoomServiceGrant = livekit.RoomServiceGrant;
} catch (e) {
  pino.info('LiveKit SDK not present or not configured.');
}

let TextToSpeechClient;
try {
  const tts = require('@google-cloud/text-to-speech');
  TextToSpeechClient = tts.TextToSpeechClient;
} catch (e) {
  pino.info('Google Cloud TTS client not available.');
}

// --- Health check (light Firestore read to assert DB connectivity) ---
app.get('/health', async (req, res) => {
  try {
    // simple read to verify connectivity; do not modify data here
    await db.doc('health/ping').get();
    return res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  } catch (err) {
    pino.error({ err }, 'health check failed');
    return res.status(500).json({ status: 'error', error: String(err) });
  }
});
app.post('/api/livekit/token', (req, res) => {
  try {
    const { identity, room } = req.body || {};
    const token = generateToken(identity || `user_${Date.now()}`, room);
    res.json({ token, url: LIVEKIT_URL });
  } catch (err) {
    console.error('LiveKit token error:', err);
    res.status(500).json({ error: 'Failed to generate LiveKit token' });
  }
});

/**
 * Create a help request
 */
app.post('/api/requests', async (req, res) => {
  try {
    const { caller_id, question_text } = req.body;

    if (!question_text || !question_text.trim()) {
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

    return res.status(201).json({ message: 'Request created', request: newRequest });
  } catch (err) {
    req.log.error({ err }, 'Error creating request');
    return res.status(500).json({ error: err.message || 'failed' });
  }
});

/**
 * List pending requests
 */
app.get('/api/requests', async (req, res) => {
  try {
    const snapshot = await db.collection('help_requests')
      .where('status', '==', 'PENDING')
      .orderBy('created_at')
      .get();
    const requests = snapshot.docs.map(d => d.data());
    return res.json({ requests });
  } catch (err) {
    req.log.error({ err }, 'fetch requests error');
    return res.status(500).json({ error: String(err) });
  }
});

/**
 * Resolve a request (update status to RESOLVED)
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
    const updated = (await docRef.get()).data();
    return res.json({ message: 'Request resolved', request: updated });
  } catch (err) {
    req.log.error({ err }, 'resolve error');
    return res.status(500).json({ error: String(err) });
  }
});

/**
 * Resolve-and-speak (correct lowercase path)
 * - Updates Firestore
 * - Optionally generates server-side TTS if configured
 *
 * NOTE: Storing large base64 blobs in Firestore is not recommended. Prefer uploading
 * generated audio to Cloud Storage (GCS/S3) and store the public URL in the document.
 */
app.put('/api/requests/:id/resolve-and-speak', async (req, res) => {
  const id = req.params.id;
  const { answer_text, answered_by, livekit_room } = req.body;

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
      answered_at: new Date().toISOString(),
      livekit_room: livekit_room || null
    };
    await docRef.update(update);

    // Try generating server-side TTS only if available
    let audio_base64 = null;
    try {
      if (!TextToSpeechClient) throw new Error('Google TTS not configured');
      const audioBuffer = await createTtsAudio(answer_text);
      audio_base64 = audioBuffer.toString('base64');

      // CAUTION: small projects may persist base64; for production prefer cloud storage URL
      await docRef.update({
        'tts.base64': audio_base64,
        'tts.mime': 'audio/mpeg'
      });
    } catch (ttsErr) {
      req.log.warn({ ttsErr }, 'TTS generation skipped/failed');
    }

    return res.json({
      message: 'resolved',
      request: update,
      tts: audio_base64 ? { base64: audio_base64, mime: 'audio/mpeg' } : null
    });
  } catch (err) {
    req.log.error({ err }, 'resolve-and-speak error');
    return res.status(500).json({ error: String(err) });
  }
});

/**
 * On-demand TTS endpoint:
 * GET /api/requests/:id/tts
 *
 * Returns stored audio if present, redirects if tts_url exists,
 * or generates audio on-demand if server TTS is configured.
 */
app.get('/api/requests/:id/tts', async (req, res) => {
  const id = req.params.id;
  try {
    const docRef = db.collection('help_requests').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'request not found' });
    const data = docSnap.data();

    if (data.tts_url) {
      return res.redirect(302, data.tts_url);
    }

    if (data.tts && data.tts.base64) {
      const b64 = data.tts.base64;
      const mime = data.tts.mime || 'audio/mpeg';
      const buffer = Buffer.from(b64, 'base64');
      res.set('Content-Type', mime);
      res.set('Content-Length', buffer.length);
      return res.send(buffer);
    }

    if (!TextToSpeechClient) {
      return res.status(501).json({ error: 'TTS not configured on server' });
    }

    const docData = docSnap.data();
    const answer_text = docData.answer_text || docData.question_text || '';
    if (!answer_text) return res.status(400).json({ error: 'no text to synthesize' });

    const buffer = await createTtsAudio(answer_text);
    // optionally upload/persist audio to storage here
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    req.log.error({ err }, 'tts on-demand error');
    return res.status(500).json({ error: String(err) });
  }
});

/**
 * LiveKit token endpoint (simple)
 */
app.post('/api/livekit/token', (req, res) => {
  const { identity, room } = req.body || {};
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL || null;

  if (!apiKey || !apiSecret || !AccessToken || !RoomServiceGrant) {
    return res.status(501).json({ error: 'LiveKit not configured on server.' });
  }
  if (!identity) return res.status(400).json({ error: 'identity required' });

  try {
    const at = new AccessToken(apiKey, apiSecret, { identity });
    if (room) {
      const grant = new RoomServiceGrant({ roomJoin: true, room });
      at.addGrant(grant);
    }
    const token = at.toJwt();
    return res.json({ token, url: livekitUrl });
  } catch (err) {
    req.log.error({ err }, 'livekit token error');
    return res.status(500).json({ error: 'livekit token error' });
  }
});

/**
 * Google Cloud TTS helper
 */
async function createTtsAudio(text, options = {}) {
  if (!TextToSpeechClient) throw new Error('TextToSpeechClient not available');
  const client = new TextToSpeechClient();

  const request = {
    input: { text },
    voice: { languageCode: options.lang || 'en-US', ssmlGender: 'FEMALE' },
    audioConfig: { audioEncoding: 'MP3' }
  };

  const [response] = await client.synthesizeSpeech(request);
  return response.audioContent; // Buffer
}

/**
 * Error handler (last middleware)
 */
app.use((err, req, res, next) => {
  // If req.log available, use it, otherwise fallback to pino
  if (req && req.log) req.log.error({ err }, 'Unhandled error');
  else pino.error({ err }, 'Unhandled error');
  const status = err && err.status ? err.status : 500;
  res.status(status).json({ error: err && err.message ? err.message : 'internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => pino.info(`Server running on port ${PORT}`));
