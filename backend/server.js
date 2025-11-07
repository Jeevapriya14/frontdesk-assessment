// server.js
require('dotenv').config();
// Demo-safe default: do not attempt Google Cloud TTS unless explicitly enabled
process.env.DISABLE_SERVER_TTS = process.env.DISABLE_SERVER_TTS || 'true';

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const cors = require('cors');
const say = require('say');

const { db, admin } = require('./src/firebase'); // ensure this file exports initialized Firestore admin
const { v4: uuidv4 } = require('uuid');

//
// Helper: ensure GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT is set
//
function ensureGoogleCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    console.log('Using GOOGLE_APPLICATION_CREDENTIALS from env:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    return;
  }

  const localPath = path.join(__dirname, 'secrets', 'serviceAccountKey.json');
  if (fs.existsSync(localPath)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = localPath;
    console.log('Set GOOGLE_APPLICATION_CREDENTIALS =>', localPath);
    return;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const parsed = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : process.env.FIREBASE_SERVICE_ACCOUNT;

      const tmpFile = path.join(os.tmpdir(), `gcloud-key-${Date.now()}.json`);
      fs.writeFileSync(tmpFile, JSON.stringify(parsed), { encoding: 'utf8', mode: 0o600 });
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpFile;
      console.log('Wrote FIREBASE_SERVICE_ACCOUNT -> temp key and set GOOGLE_APPLICATION_CREDENTIALS');
      return;
    } catch (e) {
      console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT for TTS helper:', e.message);
    }
  }

  console.warn('⚠️ No Google credentials found. TTS may not work unless you set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.');
}

ensureGoogleCredentials();

const app = express();
const pino = require('pino')();
pino.info('server starting');

app.use((req, res, next) => {
  req.log = pino.child({ reqId: Date.now() });
  next();
});

const allowedOrigins = new Set([
  'https://ai-receptionist-app.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    console.warn('CORS blocked for origin:', origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));
app.use(express.json());

let AccessToken, RoomServiceGrant;
try {
  const livekit = require('livekit-server-sdk');
  AccessToken = livekit.AccessToken;
  RoomServiceGrant = livekit.RoomServiceGrant;
} catch (e) {
  
}

let TextToSpeechClient;
try {
  const tts = require('@google-cloud/text-to-speech');
  TextToSpeechClient = tts.TextToSpeechClient;
} catch (e) {
  
}

const SERVER_TTS_ENABLED = (process.env.DISABLE_SERVER_TTS !== 'true') && !!TextToSpeechClient;
if (!SERVER_TTS_ENABLED) {
  console.log('Server TTS disabled (DISABLE_SERVER_TTS=true or @google-cloud/text-to-speech missing). Using browser/local playback only.');
} else {
  console.log('Server TTS enabled.');
}

app.get('/health', async (req, res) => {
  try {
    await db.doc('health/ping').get();
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error' });
  }
});

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


app.put('/api/requests/:id/resolve', async (req, res) => {
  try {
    const id = req.params.id;
    const { answer_text, answered_by } = req.body || {};

    if (!answer_text || !answer_text.trim()) {
      return res.status(400).json({ error: 'answer_text required' });
    }

    const docRef = db.collection('help_requests').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'request not found' });

    const now = new Date().toISOString();
    await docRef.update({
      status: 'RESOLVED',
      answer_text: answer_text,
      answered_by: answered_by || 'supervisor',
      answered_at: now
    });

    await db.collection('knowledge_base').add({
      question_text: docSnap.data().question_text || docSnap.data().question || '',
      answer_text: answer_text.trim(),
      created_at: now,
      created_by: answered_by || 'supervisor'
    });

    return res.json({ ok: true, id });
  } catch (err) {
    console.error('resolve error', err);
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/requests/:id/archive', async (req, res) => {
  try {
    const id = req.params.id;
    const docRef = db.collection('help_requests').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'request not found' });

    await docRef.update({
      status: 'ARCHIVED',
      archived_at: new Date().toISOString()
    });

    return res.json({ ok: true, id });
  } catch (err) {
    console.error('archive error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

app.get('/api/knowledge', async (req, res) => {
  try {
    const snapshot = await db.collection('knowledge_base')
      .orderBy('created_at', 'desc')
      .limit(500)
      .get();

    const knowledge = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        question_text: data.question_text,
        answer_text: data.answer_text,
        created_at: data.created_at,
        created_by: data.created_by
      };
    });

    res.json({ knowledge });
  } catch (err) {
    console.error('GET /api/knowledge error', err);
    res.status(500).json({ error: err.message });
  }
});


app.put('/api/requests/:id/resolve-and-speak', async (req, res) => {
  const id = req.params.id;
  const { answer_text, answered_by, livekit_room } = req.body || {};

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

    
    let audio_base64 = null;
    try {
      if (!SERVER_TTS_ENABLED) {
        
        console.log('Demo mode: SERVER TTS disabled (DISABLE_SERVER_TTS=true). Skipping Google TTS generation.');
        throw new Error('Server-side TTS disabled or not configured');
      }
      const audioBuffer = await createTtsAudio(answer_text);
      audio_base64 = audioBuffer.toString('base64');

      
      await docRef.update({
        'tts.base64': audio_base64,
        'tts.mime': 'audio/mpeg'
      });
    } catch (ttsErr) {
      console.warn('TTS generation skipped/failed:', ttsErr && ttsErr.message ? ttsErr.message : ttsErr);
    }

    
    try {
      say.speak(answer_text.trim(), null, 1.0, (err) => {
        if (err) console.warn('say error:', err);
        else console.log('Server said:', answer_text.trim());
      });
    } catch (sErr) {
      console.warn('say failed:', sErr);
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

    
    if (!SERVER_TTS_ENABLED) {
      return res.status(501).json({ error: 'Server TTS disabled. Set DISABLE_SERVER_TTS=false and configure GOOGLE_APPLICATION_CREDENTIALS to enable.' });
    }

    const docData = docSnap.data();
    const answer_text = docData.answer_text || docData.question_text || '';
    if (!answer_text) return res.status(400).json({ error: 'no text to synthesize' });

    const buffer = await createTtsAudio(answer_text); 
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


async function createTtsAudio(text, options = {}) {
  if (!SERVER_TTS_ENABLED) throw new Error('Text-to-Speech disabled or not configured on server.');
  if (!TextToSpeechClient) throw new Error('TextToSpeechClient is not available (missing package).');

  const client = new TextToSpeechClient();

  const request = {
    input: { text },
    voice: { languageCode: options.lang || 'en-US', ssmlGender: 'FEMALE' },
    audioConfig: { audioEncoding: 'MP3' }
  };

  const [response] = await client.synthesizeSpeech(request);
  return response.audioContent; 
}

const PORT = process.env.PORT || 4000;
function listRoutes() {
  const routes = [];
  app._router.stack.forEach(m => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).join(',').toUpperCase();
      routes.push(`${methods} ${m.route.path}`);
    } else if (m.name === 'router' && m.handle && m.handle.stack) {
      m.handle.stack.forEach(r => {
        if (r.route && r.route.path) {
          const methods = Object.keys(r.route.methods).join(',').toUpperCase();
          routes.push(`${methods} ${r.route.path}`);
        }
      });
    }
  });
  console.log('Registered routes:\n', routes.join('\n'));
}

listRoutes();
app.listen(PORT, () => pino.info(`Server running on port ${PORT}`));
