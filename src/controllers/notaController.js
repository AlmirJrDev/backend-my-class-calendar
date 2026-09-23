const mongoose = require('mongoose');
const Event = require('../models/event');
const EventNote = require('../models/eventNote');
const { filtroDeTurma } = require('../middleware/turma');
const { podeApagarNota } = require('../services/eventoService');

const erro = (res, status, mensagem, e) =>
  res.status(status).json({
    success: false,
    error: mensagem,
    ...(e && process.env.NODE_ENV === 'development' && { message: e.message })
  });

/** Evento visível para a pessoa, ou null. Id malformado conta como inexistente. */
const eventoDaTurma = (req) =>
  mongoose.isValidObjectId(req.params.id)
    ? Event.findOne({ _id: req.params.id, ...filtroDeTurma(req) }).select('turmaId')
    : null;

/**
 * Só o primeiro nome do autor: é o que a turma usa para se reconhecer, e o
 * e-mail não precisa circular entre colegas.
 */
const paraResposta = (req, nota) => ({
  _id: nota._id,
  text: nota.text,
  createdAt: nota.createdAt,
  autor: (nota.userId?.name || 'Alguém da turma').split(' ')[0],
  // Id de quem escreveu: a interface desenha o avatar a partir dele, e é o
  // mesmo valor usado na lista de membros, para o rosto não mudar de tela.
  autorId: String(nota.userId?._id ?? nota.userId),
  minha: String(nota.userId?._id ?? nota.userId) === String(req.user.id),
  podeApagar: podeApagarNota(req, nota)
});

// @desc    Observações de um evento
// @route   GET /api/events/:id/notas
exports.listarNotas = async (req, res) => {
  try {
    const evento = await eventoDaTurma(req);
    if (!evento) return erro(res, 404, 'Evento não encontrado');

    const notas = await EventNote.find({ eventId: evento._id })
      .sort({ createdAt: 1 })
      .populate('userId', 'name')
      .lean();

    res.status(200).json({ success: true, data: notas.map((n) => paraResposta(req, n)) });
  } catch (e) {
    erro(res, 500, 'Erro ao buscar as observações', e);
  }
};

// @desc    Adicionar observação — qualquer membro da turma
// @route   POST /api/events/:id/notas
exports.adicionarNota = async (req, res) => {
  try {
    const evento = await eventoDaTurma(req);
    if (!evento) return erro(res, 404, 'Evento não encontrado');

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return erro(res, 400, 'Escreva a observação');
    if (text.length > 500) return erro(res, 400, 'A observação pode ter até 500 caracteres');

    const nota = await EventNote.create({
      eventId: evento._id,
      turmaId: evento.turmaId,
      userId: req.user.id,
      text
    });
    await nota.populate('userId', 'name');

    res.status(201).json({ success: true, data: paraResposta(req, nota) });
  } catch (e) {
    erro(res, 400, 'Não foi possível salvar a observação', e);
  }
};

// @desc    Apagar observação — autor ou representante
// @route   DELETE /api/events/:id/notas/:notaId
exports.apagarNota = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.notaId)) {
      return erro(res, 404, 'Observação não encontrada');
    }

    const nota = await EventNote.findOne({
      _id: req.params.notaId,
      eventId: req.params.id,
      ...filtroDeTurma(req)
    });
    if (!nota) return erro(res, 404, 'Observação não encontrada');
    if (!podeApagarNota(req, nota)) {
      return erro(res, 403, 'Só quem escreveu ou o representante pode apagar');
    }

    await nota.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (e) {
    erro(res, 500, 'Erro ao apagar a observação', e);
  }
};
