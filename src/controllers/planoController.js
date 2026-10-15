const mongoose = require('mongoose');
const Subject = require('../models/subject');
const Event = require('../models/event');
const { gerenciaTurma } = require('../services/eventoService');
const {
  validarPlano,
  planejarEventos,
  mudancasDaMateria,
  camposDaMateria,
  camposDoEventoDoPlano,
} = require('../services/planoService');

/**
 * Carrega a matéria e confere o acesso. Devolve { materia } ou { status, erro }.
 * Ser representante de outra turma não basta: vale a turma dona da matéria.
 */
async function materiaGerenciada(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return { status: 404, erro: 'Matéria não encontrada' };

  const materia = await Subject.findById(req.params.id);
  if (!materia || !materia.turmaId) return { status: 404, erro: 'Matéria não encontrada' };

  const daTurma = (req.turmaIds || []).some((id) => id.toString() === materia.turmaId.toString());
  if (!daTurma && req.user.role !== 'superadmin') return { status: 404, erro: 'Matéria não encontrada' };

  if (!gerenciaTurma(req, materia.turmaId)) {
    return { status: 403, erro: 'Apenas o representante da turma pode importar o plano' };
  }
  return { materia };
}

/** Valida o corpo e monta o que seria feito, sem gravar nada. */
async function montar(req) {
  const acesso = await materiaGerenciada(req);
  if (acesso.erro) return acesso;
  const { materia } = acesso;

  const { erros, plano } = validarPlano(req.body);
  if (erros.length > 0) return { status: 400, erro: erros.join(' '), erros };

  const [existentes, compartilhados] = await Promise.all([
    Event.find({
      turmaId: materia.turmaId,
      $or: [{ subjectId: materia._id }, { subject: materia.name }],
    }),
    Event.find({
      turmaId: materia.turmaId,
      title: /interdisciplinar/i,
      $or: [{ subject: { $exists: false } }, { subject: '' }, { subject: null }],
    }),
  ]);

  const acoes = planejarEventos(plano, materia, existentes, compartilhados);
  return { materia, plano, acoes, mudancas: mudancasDaMateria(plano, materia) };
}

const resumo = ({ materia, plano, acoes, mudancas }) => ({
  materia: { id: materia._id, nome: materia.name },
  mudancas,
  formulaAntes: (materia.gradeFormula || []).map((i) => ({ key: i.key, label: i.label, weight: i.weight })),
  formula: plano.gradeFormula.map((i) => ({ key: i.key, label: i.label, weight: i.weight, date: i.date, grupo: i.grupo, notaMinima: i.notaMinima })),
  exame: plano.exame || null,
  eventos: acoes.map((a) => ({
    acao: a.acao,
    key: a.evento.key,
    title: a.evento.title,
    type: a.evento.type,
    date: a.evento.date,
    time: a.evento.time,
    tituloAntes: a.tituloAntes,
    motivo: a.motivo,
  })),
});

const falha = (res, e, mensagem) =>
  res.status(500).json({
    success: false,
    error: mensagem,
    ...(process.env.NODE_ENV === 'development' && { message: e.message }),
  });

// @desc    Mostra o que o plano mudaria, sem gravar
// @route   POST /api/subjects/:id/plano/previa
// @access  Representante da turma
exports.previaDoPlano = async (req, res) => {
  try {
    const r = await montar(req);
    if (r.erro) return res.status(r.status).json({ success: false, error: r.erro });
    res.status(200).json({ success: true, data: resumo(r) });
  } catch (e) {
    falha(res, e, 'Erro ao conferir o plano');
  }
};

// @desc    Grava o plano: fórmula, dados da matéria e avaliações no calendário
// @route   POST /api/subjects/:id/plano
// @access  Representante da turma
exports.importarPlano = async (req, res) => {
  try {
    const r = await montar(req);
    if (r.erro) return res.status(r.status).json({ success: false, error: r.erro });

    const { materia, plano, acoes } = r;

    materia.set(camposDaMateria(plano));
    await materia.save();

    for (const acao of acoes) {
      if (acao.acao === 'manter') continue;
      const campos = camposDoEventoDoPlano(acao, materia);
      if (acao.acao === 'atualizar') {
        const evento = await Event.findById(acao.existenteId);
        evento.set(campos);
        await evento.save();
      } else {
        await Event.create({ ...campos, turmaId: materia.turmaId, userId: req.user.id });
      }
    }

    res.status(200).json({ success: true, message: 'Plano importado', data: resumo(r) });
  } catch (e) {
    falha(res, e, 'Erro ao importar o plano');
  }
};
