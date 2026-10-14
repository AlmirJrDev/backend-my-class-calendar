const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { situacaoDosTermos, aceitarTermos, meusDados, excluirMinhaConta } = require('../controllers/contaController');

// Tudo aqui é sobre a própria conta: exige sessão e não depende de turma.
router.use(protect);

router.get('/termos', situacaoDosTermos);
router.post('/termos', aceitarTermos);
router.get('/meus-dados', meusDados);
router.delete('/', excluirMinhaConta);

module.exports = router;
