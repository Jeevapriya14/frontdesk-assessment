const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const keyPath = path.join(__dirname, 'secrets', 'serviceAccountKey.json');

if (!fs.existsSync(keyPath)) {
  console.error('❌ Service account key missing:', keyPath);
  process.exit(1);
}

const serviceAccount = require(keyPath);

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase initialized');
} catch (e) {
  console.error('init error:', e);
}

const db = admin.firestore();

(async () => {
  try {
    await db.collection('test_collection').doc('check-' + Date.now()).set({
      test: true,
      created_at: new Date().toISOString(),
    });
    console.log('✅ Firestore write OK');
  } catch (err) {
    console.error('🔥 Firestore write error:', err.message);
    console.error(err);
  }
})();
