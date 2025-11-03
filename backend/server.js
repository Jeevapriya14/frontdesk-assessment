require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, admin } = require('./src/firebase'); // adjust if your firebase init exports different names
const { v4: uuidv4 } = require('uuid');
const path = require('path');

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
  // google tts optional
}

// add to your server.js
app.get('/health', async (req, res) => {
  try {
    await db.doc('health/ping').get(); // quick Firestore / small op
    res.status(200).json({status: 'ok'});
  } catch (err) {
    res.status(500).json({status: 'error'});
  }
});


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
 * Resolve-and-speak (existing skeleton) - unchanged
 */
app.put('/api/Requests/:id/resolve-and-speak', (req, res) => {
  res.status(501).json({ error: 'use /api/requests/:id/resolve-and-speak (lowercase path) or configure TTS' });
});

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
      livekit_room: livekit_room || null
    };
    await docRef.update(update);

    // 2) Generate TTS audio buffer (optional)
    let audio_base64 = null;
    try {
      if (!TextToSpeechClient) throw new Error('Google TTS library not installed or not configured');
      const audioBuffer = await createTtsAudio(answer_text);
      audio_base64 = audioBuffer.toString('base64');

      // store generated base64 on the doc (optional) - be cautious about large documents in Firestore
      await docRef.update({
        'tts.base64': audio_base64,
        'tts.mime': 'audio/mpeg'
      });
    } catch (ttsErr) {
      console.warn('TTS generation skipped/failed:', ttsErr && ttsErr.message ? ttsErr.message : ttsErr);
    }

    res.json({
      message: 'resolved',
      request: update,
      tts: audio_base64 ? { base64: audio_base64, mime: 'audio/mpeg' } : null,
      note: 'Server attempted to generate TTS (if configured).'
    });
  } catch (err) {
    console.error('resolve-and-speak error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

/**
 * On-demand TTS endpoint:
 * GET /api/requests/:id/tts
 *
 * If the Firestore doc already contains `tts.base64` or `tts_url`, returns that directly.
 * Otherwise, if Google TTS is available, synthesize and return audio stream (audio/mpeg).
 */
app.get('/api/requests/:id/tts', async (req, res) => {
  const id = req.params.id;
  try {
    const docRef = db.collection('help_requests').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'request not found' });
    const data = docSnap.data();

    // 1) If doc has tts_url, redirect or stream it
    if (data.tts_url) {
      // Option A: redirect to external URL
      return res.redirect(302, data.tts_url);
    }

    // 2) If doc contains base64 audio, stream it
    if (data.tts && data.tts.base64) {
      const b64 = data.tts.base64;
      const mime = data.tts.mime || 'audio/mpeg';
      const buffer = Buffer.from(b64, 'base64');
      res.set('Content-Type', mime);
      res.set('Content-Length', buffer.length);
      return res.send(buffer);
    }

    // 3) If server has Google TTS client, generate on-demand
    if (!TextToSpeechClient) {
      return res.status(501).json({ error: 'TTS not configured on server. Install @google-cloud/text-to-speech and set GOOGLE_APPLICATION_CREDENTIALS.' });
    }

    const docData = docSnap.data();
    const answer_text = docData.answer_text || docData.question_text || '';
    if (!answer_text) return res.status(400).json({ error: 'no text to synthesize' });

    const buffer = await createTtsAudio(answer_text); // Buffer (mp3)
    // Optionally store the base64 back into the doc (so next time we can reuse)
    try {
      await docRef.update({
        'tts.base64': buffer.toString('base64'),
        'tts.mime': 'audio/mpeg'
      });
    } catch (e) {
      console.warn('failed to persist tts to doc', e);
    }

    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error('tts on-demand error:', err && err.stack ? err.stack : err);
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
    voice: { languageCode: options.lang || 'en-US', ssmlGender: 'FEMALE' },
    audioConfig: { audioEncoding: 'MP3' }
  };

  const [response] = await client.synthesizeSpeech(request);
  return response.audioContent; // Buffer
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server listening on', PORT);
});
