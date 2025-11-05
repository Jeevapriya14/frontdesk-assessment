import React, { useRef, useState } from 'react';
import axios from 'axios';
import { connectToRoom, publishMic } from '../utils/livekitClient';

export default function LivekitSupervisor() {
  const [roomName, setRoomName] = useState('frontdesk-demo');
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [micTrack, setMicTrack] = useState(null);

  async function joinAndPublishMic() {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/livekit/token`, {
        identity: 'supervisor_' + Math.random().toString(36).slice(2,6),
        room: roomName
      });
      const token = res.data.token;
      const url = res.data.url || import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';
      const r = await connectToRoom(token, url);
      setRoom(r);
      setConnected(true);
      // publish mic
      setPublishing(true);
      const t = await publishMic(r);
      setMicTrack(t);
      setPublishing(false);
    } catch (err) {
      console.error('supervisor join error', err);
      alert('Failed to join/publish mic: ' + (err?.message || err));
    }
  }

  function leave() {
    if (room) {
      room.disconnect();
      setRoom(null);
      setConnected(false);
    }
  }

  // Publish a pre-recorded audio element (useful to play TTS from browser)
  async function publishAudioElement(audioUrl) {
    if (!room) {
      alert('Join room first');
      return;
    }
    // create audio element and capture stream
    const audio = document.createElement('audio');
    audio.src = audioUrl;
    audio.crossOrigin = 'anonymous';
    await audio.play().catch(e => console.warn('auto-play prevented', e));
    const stream = audio.captureStream();
    const track = stream.getAudioTracks()[0];
    if (track) {
      await room.localParticipant.publishTrack(track);
      alert('Published audio element to room');
    } else {
      alert('Failed to capture audio track');
    }
  }

  return (
    <div className="p-4">
      <h2>Supervisor — LiveKit Publisher</h2>
      <div>
        <label>Room: </label>
        <input value={roomName} onChange={(e)=>setRoomName(e.target.value)} className="border px-2 py-1" />
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={joinAndPublishMic} disabled={connected || publishing} className="px-3 py-1 bg-blue-600 text-white rounded">
          {publishing ? 'Publishing…' : 'Join & Publish Mic'}
        </button>
        <button onClick={leave} disabled={!connected} className="px-3 py-1 bg-gray-300 rounded">Leave</button>
      </div>

      <div className="mt-4">
        <div>Or publish TTS/audio file into room:</div>
        <input type="text" placeholder="https://.../tts.mp3" id="audioUrl" className="border px-2 py-1" />
        <button onClick={() => publishAudioElement(document.getElementById('audioUrl').value)} className="ml-2 px-3 py-1 bg-indigo-600 text-white rounded">Publish Audio</button>
      </div>
    </div>
  );
}
