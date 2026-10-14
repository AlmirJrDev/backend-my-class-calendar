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

const { previaDoPlano, importarPlano } = require('../controllers/planoController');
const { protect } = require('../middleware/auth');
const { escopoDeTurma, exigeRepresentante } = require('../middleware/turma');

// Rotas de leitura (públicas com autenticação opcional)
router.get('/', protect, escopoDeTurma, getSubjects);
router.get('/schedule/week', protect, escopoDeTurma, getWeekSchedule);
router.get('/day/:dayOfWeek', protect, escopoDeTurma, getSubjectsByDay);
router.get('/:id', protect, escopoDeTurma, getSubject);

// Rotas de escrita (apenas admin autenticado)
router.post('/', protect, escopoDeTurma, exigeRepresentante, createSubject);
router.put('/:id', protect, escopoDeTurma, exigeRepresentante, updateSubject);
router.delete('/:id', protect, escopoDeTurma, exigeRepresentante, deleteSubject);
router.post('/:id/plano/previa', protect, escopoDeTurma, exigeRepresentante, previaDoPlano);
router.post('/:id/plano', protect, escopoDeTurma, exigeRepresentante, importarPlano);
router.patch('/:id/toggle-active', protect, escopoDeTurma, exigeRepresentante, toggleActive);

module.exports = router;