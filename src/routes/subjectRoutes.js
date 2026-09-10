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

// Rotas de leitura (públicas com autenticação opcional)
router.get('/', protect, getSubjects);
router.get('/schedule/week', protect, getWeekSchedule);
router.get('/day/:dayOfWeek', protect, getSubjectsByDay);
router.get('/:id', protect, getSubject);

// Rotas de escrita (apenas admin autenticado)
router.post('/', protect, adminOnly, createSubject);
router.put('/:id', protect, adminOnly, updateSubject);
router.delete('/:id', protect, adminOnly, deleteSubject);
router.patch('/:id/toggle-active', protect, adminOnly, toggleActive);

module.exports = router;