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
const { protect, adminOnly } = require('../middleware/auth');

// Aplicar proteção a todas as rotas
router.use(protect);

// Rotas para estudantes
router.post('/', createSuggestion);
router.get('/my-suggestions', getMySuggestions);

// Rotas apenas para admin
router.get('/pending', adminOnly, getPendingSuggestions);
router.get('/all', adminOnly, getAllSuggestions);
router.post('/:id/approve', adminOnly, approveSuggestion);
router.post('/:id/reject', adminOnly, rejectSuggestion);

// Rotas acessíveis por ambos (com validação interna)
router.get('/:id', getSuggestion);
router.delete('/:id', deleteSuggestion);

module.exports = router;