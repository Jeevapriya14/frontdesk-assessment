import React, { useEffect, useRef, useState } from 'react';
import { connectToRoom } from '../utils/livekitClient';
import axios from 'axios';

export default function LivekitCaller() {
  const [roomName, setRoomName] = useState('frontdesk-demo');
  const [connected, setConnected] = useState(false);
  const audioElRef = useRef(null);
  const roomRef = useRef(null);

  // When a remote track is subscribed, attach to audio element
  function handleTrackSubscribed(track, publication, participant) {
    if (track.kind === 'audio') {
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.controls = false;
      audioElRef.current.appendChild(audioEl);
      track.attach(audioEl);
    }
  }

  async function joinAsCaller() {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/livekit/token`, {
        identity: 'caller_' + Math.random().toString(36).slice(2,6),
        room: roomName
      });
      const token = res.data.token;
      const url = res.data.url || import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880'; // fallback
      const room = await connectToRoom(token, url);
      roomRef.current = room;
      setConnected(true);

      // subscribe events
      room.on('trackSubscribed', handleTrackSubscribed);

      // cleanup on disconnect
      room.on('disconnected', () => {
        setConnected(false);
      });
    } catch (err) {
      console.error('join error', err);
      alert('Failed to join room: ' + (err?.message || err));
    }
  }

  function leave() {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
      setConnected(false);
    }
  }

  return (
    <div className="p-4">
      <h2>Caller — LiveKit Listener</h2>
      <div className="mb-2">
        <label>Room: </label>
        <input value={roomName} onChange={(e) => setRoomName(e.target.value)} className="border px-2 py-1"/>
      </div>
      <div className="flex gap-2">
        <button onClick={joinAsCaller} disabled={connected} className="px-3 py-1 bg-green-600 text-white rounded">Join Room</button>
        <button onClick={leave} disabled={!connected} className="px-3 py-1 bg-gray-300 rounded">Leave</button>
      </div>

      <div ref={audioElRef} style={{ marginTop: 12 }} />
      <div style={{ marginTop: 8 }}>Connected: {connected ? 'Yes' : 'No'}</div>
    </div>
  );
}
