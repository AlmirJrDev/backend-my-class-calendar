const express = require('express');
const router = express.Router();
const {
  minhasTurmas,
  criarTurma,
  verConvite,
  rotacionarConvite,
  previaDoConvite,
  entrarComConvite,
  listarMembros,
  removerMembro,
  verCompartilhamento,
  ligarCompartilhamento,
  desligarCompartilhamento
} = require('../controllers/turmaController');
const { protect } = require('../middleware/auth');
const { entrarNaTurmaLimiter } = require('../middleware/rateLimit');

// Única rota sem sessão: quem recebe o link ainda não tem conta. Devolve só o
// nome e o semestre da turma, para a tela de convite ter o que mostrar.
router.get('/convite/:codigo', entrarNaTurmaLimiter, previaDoConvite);

router.use(protect);

router.route('/').get(minhasTurmas).post(criarTurma);

router.post('/entrar', entrarNaTurmaLimiter, entrarComConvite);

router.get('/:id/convite', verConvite);
router.post('/:id/convite/rotacionar', rotacionarConvite);

router.get('/:id/compartilhamento', verCompartilhamento);
router.post('/:id/compartilhamento', ligarCompartilhamento);
router.delete('/:id/compartilhamento', desligarCompartilhamento);

router.get('/:id/membros', listarMembros);
router.delete('/:id/membros/:userId', removerMembro);

module.exports = router;
