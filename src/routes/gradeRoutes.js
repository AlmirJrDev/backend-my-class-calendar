const express = require('express');
const router  = express.Router();
const { saveGrades, getGrades, clearGrade } = require('../controllers/gradeController');
const { protect } = require('../middleware/auth');

// Todas as rotas de nota exigem login
router.use(protect);

router.get('/:subjectId',             getGrades);
router.put('/:subjectId',             saveGrades);
router.delete('/:subjectId/:gradeKey', clearGrade);

module.exports = router;