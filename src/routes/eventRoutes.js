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
const { listarNotas, adicionarNota, apagarNota } = require('../controllers/notaController');

const { protect } = require('../middleware/auth');
const { escopoDeTurma, exigeRepresentante } = require('../middleware/turma');

// Rotas de leitura (públicas com autenticação opcional)
router.get('/', protect, escopoDeTurma, getEvents);
router.get('/month/:year/:month', protect, escopoDeTurma, getEventsByMonth);
router.get('/:id', protect, escopoDeTurma, getEvent);

// Observações: qualquer membro da turma lê e escreve; apagar é do autor ou do
// representante (conferido no controller).
router.get('/:id/notas', protect, escopoDeTurma, listarNotas);
router.post('/:id/notas', protect, escopoDeTurma, adicionarNota);
router.delete('/:id/notas/:notaId', protect, escopoDeTurma, apagarNota);

// Rotas de escrita (apenas admin autenticado)
router.post('/', protect, escopoDeTurma, exigeRepresentante, createEvent);
router.put('/:id', protect, escopoDeTurma, exigeRepresentante, updateEvent);
router.delete('/:id', protect, escopoDeTurma, exigeRepresentante, deleteEvent);
router.patch('/:id/toggle-complete', protect, escopoDeTurma, exigeRepresentante, toggleComplete);

module.exports = router;