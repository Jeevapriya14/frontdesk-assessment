
const { AccessToken } = require('livekit-server-sdk'); 
const crypto = require('crypto');

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

function generateToken(identity, room = null, ttlSeconds = 60) {
  
  const at = new AccessToken(API_KEY, API_SECRET, { identity });
  if (room) at.addGrant({ roomJoin: true, room: room });
  
  return at.toJwt();
}

module.exports = { generateToken, LIVEKIT_URL };
