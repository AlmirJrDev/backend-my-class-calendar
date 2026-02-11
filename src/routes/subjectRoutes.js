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

const { protect, optionalAuth, adminOnly } = require('../middleware/auth');

// Rotas de leitura (públicas com autenticação opcional)
router.get('/', optionalAuth, getSubjects);
router.get('/schedule/week', optionalAuth, getWeekSchedule);
router.get('/day/:dayOfWeek', optionalAuth, getSubjectsByDay);
router.get('/:id', optionalAuth, getSubject);

// Rotas de escrita (apenas admin autenticado)
router.post('/', protect, adminOnly, createSubject);
router.put('/:id', protect, adminOnly, updateSubject);
router.delete('/:id', protect, adminOnly, deleteSubject);
router.patch('/:id/toggle-active', protect, adminOnly, toggleActive);

module.exports = router;