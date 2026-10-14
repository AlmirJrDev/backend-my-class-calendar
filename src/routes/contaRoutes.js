const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { situacaoDosTermos, aceitarTermos, excluirMinhaConta, mudarNome } = require('../controllers/contaController');

// Tudo aqui é sobre a própria conta: exige sessão e não depende de turma.
router.use(protect);

router.get('/termos', situacaoDosTermos);
router.post('/termos', aceitarTermos);
router.patch('/', mudarNome);
router.delete('/', excluirMinhaConta);

module.exports = router;
