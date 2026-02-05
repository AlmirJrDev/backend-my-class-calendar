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

// Aplicar proteção a todas as rotas
router.use(protect);

// Rotas de leitura (todos podem ver)
router.get('/', getSubjects);
router.get('/schedule/week', getWeekSchedule);
router.get('/day/:dayOfWeek', getSubjectsByDay);
router.get('/:id', getSubject);

// Rotas de escrita (apenas admin)
router.post('/', adminOnly, createSubject);
router.put('/:id', adminOnly, updateSubject);
router.delete('/:id', adminOnly, deleteSubject);
router.patch('/:id/toggle-active', adminOnly, toggleActive);

module.exports = router;