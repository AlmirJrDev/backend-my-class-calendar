const express = require('express');
const router = express.Router();
const {
  recordAttendance,
  bulkRecordAttendance,
  getSubjectStats,
  getAllStats,
  getSubjectHistory,
  getAllHistory,
  updateAttendance,
  deleteAttendance,
  getAtRiskSubjects,
  getSummary
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');

// Aplicar proteção a todas as rotas
router.use(protect);

// Rotas de registro
router.post('/', recordAttendance);
router.post('/bulk', bulkRecordAttendance);

// Rotas de estatísticas
router.get('/stats', getAllStats);
router.get('/stats/:subjectId', getSubjectStats);
router.get('/summary', getSummary);
router.get('/at-risk', getAtRiskSubjects);

// Rotas de histórico
router.get('/history', getAllHistory);
router.get('/history/:subjectId', getSubjectHistory);

// Rotas de manipulação individual
router.put('/:id', updateAttendance);
router.delete('/:id', deleteAttendance);

module.exports = router;