const express = require('express');
const router = express.Router();
const {
  createSuggestion,
  getMySuggestions,
  getPendingSuggestions,
  getAllSuggestions,
  approveSuggestion,
  rejectSuggestion,
  getSuggestion,
  deleteSuggestion
} = require('../controllers/suggestionController');
const { protect } = require('../middleware/auth');
const { escopoDeTurma, exigeRepresentante } = require('../middleware/turma');

// Toda rota exige sessão e o escopo de turma de quem está pedindo.
router.use(protect, escopoDeTurma);

// Rotas para estudantes
router.post('/', createSuggestion);
router.get('/my-suggestions', getMySuggestions);

// Moderação: só o representante da turma
router.get('/pending', exigeRepresentante, getPendingSuggestions);
router.get('/all', exigeRepresentante, getAllSuggestions);
router.post('/:id/approve', exigeRepresentante, approveSuggestion);
router.post('/:id/reject', exigeRepresentante, rejectSuggestion);

// Rotas acessíveis por ambos (com validação interna)
router.get('/:id', getSuggestion);
router.delete('/:id', deleteSuggestion);

module.exports = router;