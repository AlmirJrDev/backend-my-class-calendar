const express = require('express');
const router = express.Router();
const {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  toggleComplete,
  getEventsByMonth
} = require('../controllers/eventController');

const { protect, optionalAuth, adminOnly } = require('../middleware/auth');

// Rotas de leitura (públicas com autenticação opcional)
router.get('/', optionalAuth, getEvents);
router.get('/month/:year/:month', optionalAuth, getEventsByMonth);
router.get('/:id', optionalAuth, getEvent);

// Rotas de escrita (apenas admin autenticado)
router.post('/', protect, adminOnly, createEvent);
router.put('/:id', protect, adminOnly, updateEvent);
router.delete('/:id', protect, adminOnly, deleteEvent);
router.patch('/:id/toggle-complete', protect, adminOnly, toggleComplete);

module.exports = router;