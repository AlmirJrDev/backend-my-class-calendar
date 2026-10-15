const express = require('express');
const router  = express.Router();
const { saveGrades, getGrades, clearGrade } = require('../controllers/gradeController');
const { protect } = require('../middleware/auth');
const { escopoDeTurma } = require('../middleware/turma');

// Todas as rotas de nota exigem login e só aceitam matéria da turma da pessoa
router.use(protect, escopoDeTurma);

router.get('/:subjectId',             getGrades);
router.put('/:subjectId',             saveGrades);
router.delete('/:subjectId/:gradeKey', clearGrade);

module.exports = router;