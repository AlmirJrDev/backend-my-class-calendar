const express = require('express');
const router = express.Router();
const {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  toggleActive,
  getWeekSchedule,
  getSubjectsByDay
} = require('../controllers/subjectController');

const { protect, adminOnly } = require('../middleware/auth');
const { escopoDeTurma } = require('../middleware/turma');

// Rotas de leitura (públicas com autenticação opcional)
router.get('/', protect, escopoDeTurma, getSubjects);
router.get('/schedule/week', protect, escopoDeTurma, getWeekSchedule);
router.get('/day/:dayOfWeek', protect, escopoDeTurma, getSubjectsByDay);
router.get('/:id', protect, escopoDeTurma, getSubject);

// Rotas de escrita (apenas admin autenticado)
router.post('/', protect, escopoDeTurma, adminOnly, createSubject);
router.put('/:id', protect, adminOnly, updateSubject);
router.delete('/:id', protect, adminOnly, deleteSubject);
router.patch('/:id/toggle-active', protect, adminOnly, toggleActive);

module.exports = router;