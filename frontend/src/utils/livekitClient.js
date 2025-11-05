import { Room, createLocalAudioTrack } from '@livekit/client';

// Connects and returns the room instance (caller or supervisor)
export async function connectToRoom(token, url) {
  const room = new Room();
  await room.connect(url, token, { autoSubscribe: true });
  return room;
}

// Create a mic audio track (permission prompt)
export async function publishMic(room) {
  const track = await createLocalAudioTrack();
  await room.localParticipant.publishTrack(track);
  return track;
}
