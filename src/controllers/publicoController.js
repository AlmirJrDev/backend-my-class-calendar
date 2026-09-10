const Turma = require('../models/turma');
const Subject = require('../models/subject');
const Event = require('../models/event');

/**
 * Leitura aberta do calendário de uma turma, protegida por um token secreto na
 * URL. É o "link para compartilhar": quem tem o link vê, quem não tem não.
 *
 * O token é separado do convite de propósito — ver o calendário não pode virar
 * entrada na turma.
 *
 * Nada aqui devolve membro, nota, presença, sugestão ou qualquer id interno de
 * usuário. Os campos são escolhidos um a um, e não filtrados por exclusão: com
 * lista de permissão, um campo novo no model não vaza sozinho.
 */

const erro = (res, status, mensagem, e) =>
  res.status(status).json({
    success: false,
    error: mensagem,
    ...(process.env.NODE_ENV === 'development' && e && { message: e.message })
  });

/** Resolve a turma pelo token, ou null se o link não vale. */
async function turmaPeloToken(token) {
  if (!token) return null;
  return Turma.findOne({ shareToken: token, active: true }).select('name semester').lean();
}

// @desc    Identifica a turma do link, para a tela ter cabeçalho
// @route   GET /api/publico/:token
exports.turmaCompartilhada = async (req, res) => {
  try {
    const turma = await turmaPeloToken(req.params.token);
    if (!turma) return erro(res, 404, 'Link inválido ou desativado');

    res.status(200).json({
      success: true,
      data: { name: turma.name, semester: turma.semester }
    });
  } catch (e) {
    erro(res, 500, 'Erro ao abrir o calendário', e);
  }
};

// @desc    Eventos de um mês da turma do link
// @route   GET /api/publico/:token/eventos/:ano/:mes
exports.eventosCompartilhados = async (req, res) => {
  try {
    const turma = await turmaPeloToken(req.params.token);
    if (!turma) return erro(res, 404, 'Link inválido ou desativado');

    const ano = Number(req.params.ano);
    const mes = Number(req.params.mes);
    if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
      return erro(res, 400, 'Mês ou ano inválido');
    }

    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    const eventos = await Event.find({
      turmaId: turma._id,
      date: { $gte: inicio, $lte: fim }
    })
      .select('title type date time subject description recurring daysOfWeek')
      .sort({ date: 1, time: 1 })
      .lean();

    res.status(200).json({ success: true, count: eventos.length, data: eventos });
  } catch (e) {
    erro(res, 500, 'Erro ao buscar os eventos', e);
  }
};

// @desc    Grade horária da semana da turma do link
// @route   GET /api/publico/:token/grade
exports.gradeCompartilhada = async (req, res) => {
  try {
    const turma = await turmaPeloToken(req.params.token);
    if (!turma) return erro(res, 404, 'Link inválido ou desativado');

    const materias = await Subject.find({ turmaId: turma._id, active: true })
      .select('name teacher color schedule')
      .lean();

    const grade = { 0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} };

    materias.forEach((m) => {
      (m.schedule || []).forEach(({ dayOfWeek, periods }) => {
        periods.forEach((p) => {
          grade[dayOfWeek][p] = grade[dayOfWeek][p] || [];
          grade[dayOfWeek][p].push({
            subjectName: m.name,
            teacher: m.teacher,
            color: m.color
          });
        });
      });
    });

    res.status(200).json({ success: true, data: grade });
  } catch (e) {
    erro(res, 500, 'Erro ao buscar a grade', e);
  }
};
