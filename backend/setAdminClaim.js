// backend/setAdminClaim.js
const admin = require('firebase-admin');
const path = require('path');

const keyPath = path.join(__dirname, 'secrets', 'serviceAccountKey.json');
if (!require('fs').existsSync(keyPath)) {
  console.error('service account key missing at', keyPath);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath))
});

async function setAdmin(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    console.log('found user', user.uid);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log('custom claim set for', email);
    console.log('User must sign out and sign-in to get updated token.');
  } catch (err) {
    console.error('error setting admin claim:', err);
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node setAdminClaim.js user@example.com');
  process.exit(1);
}
setAdmin(email).then(() => process.exit(0));
