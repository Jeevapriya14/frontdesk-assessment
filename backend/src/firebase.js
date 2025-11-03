// backend/src/firebase.js
const admin = require('firebase-admin');

// Try to load credentials from env (Render)
let serviceAccount = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    // Parse JSON string stored in Render env var
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', err);
  }
}

if (!serviceAccount) {
  console.error('Firebase service account missing — check Render environment variables!');
  throw new Error('Service account missing and emulator not configured.');
}

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

console.log('✅ Firebase Admin initialized successfully');

module.exports = { admin, db };
