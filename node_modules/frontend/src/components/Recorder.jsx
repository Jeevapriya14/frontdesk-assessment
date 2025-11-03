import React, { useState, useRef } from 'react';
import { api } from '../utils/api';

export default function Recorder({ callerId = 'test-user-001', onUploaded }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunks = useRef([]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    chunks.current = [];
    mediaRecorder.ondataavailable = e => chunks.current.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      await uploadAudio(blob);
    };
    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function uploadAudio(blob) {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'recording.webm');
      form.append('caller_id', callerId);

      const res = await api.post('/api/requests/audio', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (onUploaded) onUploaded(res.data);
      alert('Uploaded successfully');
    } catch (e) {
      console.error('upload error', e);
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded bg-white w-80">
      <h4 className="font-semibold mb-2">Record your question</h4>
      <div className="flex gap-3 items-center">
        {!recording && (
          <button
            onClick={startRecording}
            className="px-3 py-1 bg-red-600 text-white rounded"
            disabled={loading}
          >
            🎙️ Start
          </button>
        )}
        {recording && (
          <button
            onClick={stopRecording}
            className="px-3 py-1 bg-gray-700 text-white rounded"
          >
            ⏹ Stop
          </button>
        )}
        {audioUrl && (
          <audio controls src={audioUrl} className="mt-2 w-full" />
        )}
      </div>
      {loading && <div className="text-sm text-gray-500 mt-2">Uploading...</div>}
    </div>
  );
}
