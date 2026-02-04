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

const { protect, adminOnly } = require('../middleware/auth');

// Aplicar proteção a todas as rotas
router.use(protect);

// Rotas de leitura (todos podem ver)
router.get('/', getEvents);
router.get('/month/:year/:month', getEventsByMonth);
router.get('/:id', getEvent);

// Rotas de escrita (apenas admin)
router.post('/', adminOnly, createEvent);
router.put('/:id', adminOnly, updateEvent);
router.delete('/:id', adminOnly, deleteEvent);
router.patch('/:id/toggle-complete', adminOnly, toggleComplete);

module.exports = router;