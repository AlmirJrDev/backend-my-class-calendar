const express = require('express');
const router = express.Router();
const {
  listarMateriais,
  adicionarMaterial,
  removerMaterial
} = require('../controllers/materialController');
const { protect } = require('../middleware/auth');
const { escopoDeTurma } = require('../middleware/turma');

// Qualquer membro lê e adiciona; remover é de quem adicionou ou do
// representante (conferido no controller).
router.use(protect, escopoDeTurma);

router.get('/', listarMateriais);
router.post('/', adicionarMaterial);
router.delete('/:id', removerMaterial);

module.exports = router;
