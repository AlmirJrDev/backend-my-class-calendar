const express = require('express');
const router = express.Router();
const { meuLink, rotacionar, feed } = require('../controllers/calendarioController');
const { protect } = require('../middleware/auth');
const { linkPublicoLimiter } = require('../middleware/rateLimit');

// O link é de cada pessoa e traz todas as turmas dela numa assinatura só.
router.get('/assinatura', protect, meuLink);
router.post('/assinatura/rotacionar', protect, rotacionar);

// Aberto: quem busca é o servidor do Google ou o celular, sem sessão. O
// segredo é o token, e o limite impede varrer tokens por tentativa.
router.get('/:token.ics', linkPublicoLimiter, feed);

module.exports = router;
