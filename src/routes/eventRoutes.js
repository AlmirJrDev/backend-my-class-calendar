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

// Middleware de autenticação (você precisará implementar)
const { protect } = require('../middleware/auth');

// Aplicar proteção a todas as rotas
router.use(protect);

// Rotas principais
router
  .route('/')
  .get(getEvents)
  .post(createEvent);

// Rota para eventos do mês
router.get('/month/:year/:month', getEventsByMonth);

// Rotas específicas por ID
router
  .route('/:id')
  .get(getEvent)
  .put(updateEvent)
  .delete(deleteEvent);

// Rota para marcar/desmarcar como concluído
router.patch('/:id/toggle-complete', toggleComplete);

module.exports = router;