const express = require('express');
const router = express.Router();
const {
  avisarChamada,
  horariosTipicos,
  chamadasDeHoje,
  desfazerChamada
} = require('../controllers/chamadaController');
const { protect } = require('../middleware/auth');
const { escopoDeTurma } = require('../middleware/turma');

// Avisar é de qualquer membro: quem está na sala é quem vê o professor
// anunciar a chamada.
router.use(protect, escopoDeTurma);

router.post('/', avisarChamada);
router.get('/horarios', horariosTipicos);
router.get('/hoje', chamadasDeHoje);
router.delete('/:id', desfazerChamada);

module.exports = router;
