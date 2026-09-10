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
const { escopoDeTurma } = require('../middleware/turma');

// Rotas de leitura (públicas com autenticação opcional)
router.get('/', protect, escopoDeTurma, getEvents);
router.get('/month/:year/:month', protect, escopoDeTurma, getEventsByMonth);
router.get('/:id', protect, escopoDeTurma, getEvent);

// Rotas de escrita (apenas admin autenticado)
router.post('/', protect, escopoDeTurma, adminOnly, createEvent);
router.put('/:id', protect, adminOnly, updateEvent);
router.delete('/:id', protect, adminOnly, deleteEvent);
router.patch('/:id/toggle-complete', protect, adminOnly, toggleComplete);

module.exports = router;