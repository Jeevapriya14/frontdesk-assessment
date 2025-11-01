// backend/src/livekit.js
const { AccessToken } = require('livekit-server-sdk'); // if package differs, adapt to installed SDK
const crypto = require('crypto');

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL; // e.g. https://try.livekit.io or your LiveKit host

function generateToken(identity, room = null, ttlSeconds = 60) {
  // AccessToken from livekit-server-sdk
  const at = new AccessToken(API_KEY, API_SECRET, { identity });
  if (room) at.addGrant({ roomJoin: true, room: room });
  // optional: set ttl if supported
  return at.toJwt();
}

module.exports = { generateToken, LIVEKIT_URL };
