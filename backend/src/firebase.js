// backend/src/firebase.js (emulator-friendly)
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const keyPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('serviceAccountKey.json missing at', keyPath);
  // still continue for emulator mode if you want
}

const serviceAccount = fs.existsSync(keyPath) ? require(keyPath) : null;

// If using emulator set env var FIRESTORE_EMULATOR_HOST=localhost:8080
if (process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  // Using emulator: do not call admin.credential.cert when not available
  admin.initializeApp();
  console.log('Using Firestore emulator at', process.env.FIRESTORE_EMULATOR_HOST);
} else {
  if (!serviceAccount) throw new Error('Service account missing and emulator not configured.');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
module.exports = { admin, db };
