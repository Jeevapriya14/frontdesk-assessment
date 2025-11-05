// backend/src/db/rooms.js
const { db } = require('../firebase');

// Collection references
const roomsCollection = db.collection('rooms');
const bookingsCollection = db.collection('bookings');

// Get room details by ID
async function getRoom(roomId) {
  try {
    const doc = await roomsCollection.doc(roomId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (err) {
    console.error('Error in getRoom:', err);
    throw err;
  }
}

// Get all available rooms
async function listRooms() {
  try {
    const snapshot = await roomsCollection.get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error in listRooms:', err);
    throw err;
  }
}

// Create a booking entry
async function createBooking(data) {
  try {
    const docRef = await bookingsCollection.add({
      ...data,
      created_at: new Date().toISOString(),
      status: 'CONFIRMED',
    });
    return { id: docRef.id };
  } catch (err) {
    console.error('Error in createBooking:', err);
    throw err;
  }
}

// List all bookings
async function listBookings() {
  try {
    const snapshot = await bookingsCollection.orderBy('created_at', 'desc').get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error in listBookings:', err);
    throw err;
  }
}

module.exports = {
  getRoom,
  listRooms,
  createBooking,
  listBookings,
};
