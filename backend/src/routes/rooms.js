// backend/src/routes/rooms.js
const express = require('express');
const router = express.Router();
const { getRoom, listRooms, createBooking, listBookings } = require('../db/rooms');

// Get all rooms
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await listRooms();
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single room details
router.get('/rooms/:id', async (req, res) => {
  try {
    const room = await getRoom(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new booking
router.post('/bookings', async (req, res) => {
  try {
    const data = req.body;
    if (!data.room_id || !data.guest_name) {
      return res.status(400).json({ success: false, message: 'room_id and guest_name required' });
    }

    const result = await createBooking(data);
    res.status(201).json({ success: true, booking_id: result.id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List all bookings
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await listBookings();
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
