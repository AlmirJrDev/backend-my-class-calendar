const express = require('express');
const router = express.Router();
const {
  turmaCompartilhada,
  eventosCompartilhados,
  gradeCompartilhada,
  materiasCompartilhadas
} = require('../controllers/publicoController');
const { linkPublicoLimiter } = require('../middleware/rateLimit');

// Sem sessão por definição: o segredo é o próprio token da URL. O limite é o
// que impede alguém de varrer tokens por tentativa.
router.use(linkPublicoLimiter);

router.get('/:token', turmaCompartilhada);
router.get('/:token/eventos/:ano/:mes', eventosCompartilhados);
router.get('/:token/grade', gradeCompartilhada);
router.get('/:token/materias', materiasCompartilhadas);

module.exports = router;
