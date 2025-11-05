// backend/src/routes/bookings.js
const express = require('express');
const router = express.Router();
const { db } = require('../firebase'); // Firestore instance

/**
 * POST /api/bookings
 * Create a new booking
 * Body: { room_id, guest_name, checkin_date, checkout_date, notes? }
 */
router.post('/bookings', async (req, res) => {
  try {
    const { room_id, guest_name, checkin_date, checkout_date, notes } = req.body;

    if (!room_id || !guest_name || !checkin_date || !checkout_date) {
      return res.status(400).json({
        success: false,
        message: 'room_id, guest_name, checkin_date, and checkout_date are required'
      });
    }

    const bookingData = {
      room_id,
      guest_name,
      checkin_date,
      checkout_date,
      notes: notes || '',
      status: 'CONFIRMED',
      created_at: new Date().toISOString()
    };

    const ref = await db.collection('bookings').add(bookingData);
    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking_id: ref.id,
      data: bookingData
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    return res.status(500).json({ success: false, message: 'Failed to create booking' });
  }
});

/**
 * GET /api/bookings
 * Fetch all bookings (optional query: ?room_id=101)
 */
router.get('/bookings', async (req, res) => {
  try {
    const { room_id } = req.query;
    let query = db.collection('bookings');

    if (room_id) query = query.where('room_id', '==', room_id);

    const snapshot = await query.orderBy('created_at', 'desc').get();

    if (snapshot.empty) {
      return res.json({ success: true, bookings: [] });
    }

    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/bookings/:id
 * Fetch a single booking by ID
 */
router.get('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('bookings').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return res.json({ success: true, booking: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error('Error fetching booking:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
});

module.exports = router;
