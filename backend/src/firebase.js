const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function loadServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn("FIREBASE_SERVICE_ACCOUNT found but JSON.parse failed:", err.message);
    return null;
  }
}

function loadServiceAccountFromFile() {
  const localPath = path.join(__dirname, "..", "secrets", "serviceAccountKey.json");
  if (fs.existsSync(localPath)) {
    try {
      const raw = fs.readFileSync(localPath, "utf8");
      return JSON.parse(raw);
    } catch (err) {
      console.warn("Failed to read/parse local serviceAccountKey.json:", err.message);
      return null;
    }
  }
  return null;
}

let serviceAccount = loadServiceAccountFromEnv();

if (!serviceAccount) {
  serviceAccount = loadServiceAccountFromFile();
  if (serviceAccount) {
    console.log(" Using local backend/secrets/serviceAccountKey.json for Firebase Admin (dev mode).");
  }
}

if (!serviceAccount) {
  console.error(
    "Firebase service account missing — set FIREBASE_SERVICE_ACCOUNT env var or place serviceAccountKey.json in backend/secrets/"
  );
  throw new Error("Service account missing and emulator not configured.");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

console.log(" Firebase Admin initialized successfully");

module.exports = { admin, db };
