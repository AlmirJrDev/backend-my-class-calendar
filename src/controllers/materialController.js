const mongoose = require('mongoose');
const Material = require('../models/material');
const Subject = require('../models/subject');
const Event = require('../models/event');
const { filtroDeTurma } = require('../middleware/turma');
const { gerenciaTurma } = require('../services/eventoService');
const { linkValido, podeApagarMaterial } = require('../services/materialService');

const erro = (res, status, mensagem, e) =>
  res.status(status).json({
    success: false,
    error: mensagem,
    ...(e && process.env.NODE_ENV === 'development' && { message: e.message })
  });

/** Só o primeiro nome de quem adicionou, como nas observações. */
const paraResposta = (req, material) => ({
  _id: material._id,
  title: material.title,
  url: material.url,
  subjectId: String(material.subjectId),
  eventId: material.eventId ? String(material.eventId) : null,
  createdAt: material.createdAt,
  autor: (material.userId?.name || 'Alguém da turma').split(' ')[0],
  autorId: String(material.userId?._id ?? material.userId),
  podeApagar: podeApagarMaterial(req, material, gerenciaTurma(req, material.turmaId))
});

// @desc    Materiais das turmas da pessoa (filtra por matéria ou prova)
// @route   GET /api/materiais?subjectId=&eventId=
// @access  Membro da turma
exports.listarMateriais = async (req, res) => {
  try {
    const filtro = { ...filtroDeTurma(req) };
    if (req.query.subjectId) {
      if (!mongoose.isValidObjectId(req.query.subjectId)) return erro(res, 400, 'Matéria inválida');
      filtro.subjectId = req.query.subjectId;
    }
    if (req.query.eventId) {
      if (!mongoose.isValidObjectId(req.query.eventId)) return erro(res, 400, 'Prova inválida');
      filtro.eventId = req.query.eventId;
    }

    const materiais = await Material.find(filtro)
      .sort({ createdAt: -1 })
      .limit(300)
      .populate('userId', 'name')
      .lean();

    res.status(200).json({ success: true, data: materiais.map((m) => paraResposta(req, m)) });
  } catch (e) {
    erro(res, 500, 'Erro ao buscar os materiais', e);
  }
};

// @desc    Adicionar um material — qualquer membro da turma
// @route   POST /api/materiais
// @access  Membro da turma
exports.adicionarMaterial = async (req, res) => {
  try {
    const { subjectId, eventId } = req.body;
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const url = linkValido(req.body.url);

    if (!title) return erro(res, 400, 'Dê um nome ao material');
    if (title.length > 120) return erro(res, 400, 'O nome pode ter até 120 caracteres');
    if (!url) return erro(res, 400, 'Cole um link que comece com http:// ou https://');
    if (!mongoose.isValidObjectId(subjectId)) return erro(res, 400, 'Escolha a matéria');

    // A matéria manda a turma: ninguém adiciona material na turma alheia.
    const materia = await Subject.findOne({ _id: subjectId, ...filtroDeTurma(req) }).select('turmaId');
    if (!materia) return erro(res, 404, 'Matéria não encontrada');

    if (eventId) {
      if (!mongoose.isValidObjectId(eventId)) return erro(res, 400, 'Prova inválida');
      const prova = await Event.exists({ _id: eventId, turmaId: materia.turmaId });
      if (!prova) return erro(res, 404, 'Prova não encontrada nesta turma');
    }

    const material = await Material.create({
      turmaId: materia.turmaId,
      subjectId,
      eventId: eventId || undefined,
      title,
      url,
      userId: req.user.id
    });
    await material.populate('userId', 'name');

    res.status(201).json({ success: true, data: paraResposta(req, material) });
  } catch (e) {
    erro(res, 400, 'Não foi possível adicionar o material', e);
  }
};

// @desc    Remover um material — quem adicionou ou o representante
// @route   DELETE /api/materiais/:id
// @access  Membro da turma
exports.removerMaterial = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return erro(res, 404, 'Material não encontrado');

    const material = await Material.findOne({ _id: req.params.id, ...filtroDeTurma(req) });
    if (!material) return erro(res, 404, 'Material não encontrado');

    if (!podeApagarMaterial(req, material, gerenciaTurma(req, material.turmaId))) {
      return erro(res, 403, 'Só quem adicionou ou o representante pode remover');
    }

    await material.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (e) {
    erro(res, 500, 'Erro ao remover o material', e);
  }
};
