const mongoose = require('mongoose');
const Chamada = require('../models/chamada');
const Subject = require('../models/subject');
const { filtroDeTurma } = require('../middleware/turma');
const { horarioTipico, comoHora, minutoDoDia, podeDesfazer } = require('../services/chamadaService');
const { gerenciaTurma } = require('../services/eventoService');

const erro = (res, status, mensagem, e) =>
  res.status(status).json({
    success: false,
    error: mensagem,
    ...(e && process.env.NODE_ENV === 'development' && { message: e.message })
  });

/** Quantos dias de histórico entram na conta do horário típico. */
const DIAS_DE_HISTORICO = 70;

// @desc    Avisar que o professor está fazendo chamada agora
// @route   POST /api/chamadas
// @access  Membro da turma
exports.avisarChamada = async (req, res) => {
  try {
    const { subjectId, period } = req.body;

    if (!mongoose.isValidObjectId(subjectId)) return erro(res, 400, 'Informe a matéria');
    if (!(period >= 1 && period <= 5)) return erro(res, 400, 'Informe o período da aula');

    // A matéria manda a turma: assim ninguém avisa chamada na turma alheia.
    const materia = await Subject.findOne({ _id: subjectId, ...filtroDeTurma(req) }).select('turmaId');
    if (!materia) return erro(res, 404, 'Matéria não encontrada');

    const agora = new Date();
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

    // Um aviso por aula: o segundo toque não conta de novo, mas também não é
    // erro — quem avisou depois só confirma o que já está registrado.
    const chamada = await Chamada.findOneAndUpdate(
      { turmaId: materia.turmaId, subjectId, dia, period },
      {
        $setOnInsert: {
          turmaId: materia.turmaId,
          subjectId,
          dia,
          period,
          minutoDoDia: minutoDoDia(agora),
          userId: req.user.id
        }
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Aviso registrado',
      data: {
        subjectId,
        period,
        horario: comoHora(chamada.minutoDoDia),
        jaAvisada: chamada.minutoDoDia !== minutoDoDia(agora)
      }
    });
  } catch (e) {
    erro(res, 500, 'Erro ao registrar o aviso', e);
  }
};

// @desc    Horário típico da chamada de cada matéria da turma
// @route   GET /api/chamadas/horarios
// @access  Membro da turma
exports.horariosTipicos = async (req, res) => {
  try {
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_DE_HISTORICO);

    const avisos = await Chamada.find({ ...filtroDeTurma(req), dia: { $gte: desde } })
      .sort({ dia: -1 })
      .select('subjectId minutoDoDia dia')
      .lean();

    const porMateria = new Map();
    for (const aviso of avisos) {
      const chave = String(aviso.subjectId);
      if (!porMateria.has(chave)) porMateria.set(chave, []);
      porMateria.get(chave).push(aviso.minutoDoDia);
    }

    const data = [];
    for (const [subjectId, minutos] of porMateria) {
      const tipico = horarioTipico(minutos);
      if (tipico) {
        data.push({
          subjectId,
          minutoDoDia: tipico.minutoDoDia,
          horario: comoHora(tipico.minutoDoDia),
          amostras: tipico.amostras
        });
      }
    }

    res.status(200).json({ success: true, count: data.length, data });
  } catch (e) {
    erro(res, 500, 'Erro ao buscar os horários', e);
  }
};

// @desc    Avisos de chamada de hoje na turma
// @route   GET /api/chamadas/hoje
// @access  Membro da turma
exports.chamadasDeHoje = async (req, res) => {
  try {
    const agora = new Date();
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

    const avisos = await Chamada.find({ ...filtroDeTurma(req), dia })
      .select('subjectId period minutoDoDia turmaId userId')
      .lean();

    res.status(200).json({
      success: true,
      data: avisos.map((a) => ({
        _id: String(a._id),
        subjectId: String(a.subjectId),
        period: a.period,
        horario: comoHora(a.minutoDoDia),
        podeDesfazer: podeDesfazer(req, a, gerenciaTurma(req, a.turmaId))
      }))
    });
  } catch (e) {
    erro(res, 500, 'Erro ao buscar os avisos de hoje', e);
  }
};

// @desc    Desfazer um aviso de chamada
// @route   DELETE /api/chamadas/:id
// @access  Quem avisou, ou o representante da turma
exports.desfazerChamada = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return erro(res, 404, 'Aviso não encontrado');

    const chamada = await Chamada.findOne({ _id: req.params.id, ...filtroDeTurma(req) });
    if (!chamada) return erro(res, 404, 'Aviso não encontrado');

    if (!podeDesfazer(req, chamada, gerenciaTurma(req, chamada.turmaId))) {
      return erro(res, 403, 'Só quem avisou ou o representante pode desfazer');
    }

    await chamada.deleteOne();
    res.status(200).json({ success: true, message: 'Aviso desfeito', data: {} });
  } catch (e) {
    erro(res, 500, 'Erro ao desfazer o aviso', e);
  }
};
