const mongoose = require('mongoose');
const Turma = require('../models/turma');
const TurmaMember = require('../models/turmaMember');
const { podeExcluir, confereNome, contarDaTurma, excluirTurma } = require('../services/exclusaoDeTurmaService');

const erro = (res, status, mensagem, e) =>
  res.status(status).json({
    success: false,
    error: mensagem,
    ...(process.env.NODE_ENV === 'development' && e && { message: e.message })
  });

/** Papel da pessoa numa turma, ou null se ela não participa. */
async function papelEm(turmaId, userId) {
  const v = await TurmaMember.findOne({ turmaId, userId }).select('role').lean();
  return v ? v.role : null;
}

// @desc    Turmas de que a pessoa participa
// @route   GET /api/turmas
exports.minhasTurmas = async (req, res) => {
  try {
    const vinculos = await TurmaMember.find({ userId: req.user.id })
      .populate('turmaId', 'name semester active ownerId')
      .lean();

    const turmas = vinculos
      .filter((v) => v.turmaId)
      .map((v) => ({
        _id: v.turmaId._id,
        name: v.turmaId.name,
        semester: v.turmaId.semester,
        active: v.turmaId.active,
        role: v.role,
        // Só quem criou a turma pode excluí-la; o front usa para mostrar a opção.
        ehDono: String(v.turmaId.ownerId) === req.user.id
      }));

    res.status(200).json({ success: true, count: turmas.length, data: turmas });
  } catch (e) {
    erro(res, 500, 'Erro ao buscar suas turmas', e);
  }
};

// @desc    Cria uma turma; quem cria vira representante
// @route   POST /api/turmas
exports.criarTurma = async (req, res) => {
  try {
    const { name, semester } = req.body;
    if (!name) return erro(res, 400, 'A turma precisa de um nome');

    const turma = await Turma.create({ name, semester, ownerId: req.user.id });
    await TurmaMember.create({
      turmaId: turma._id,
      userId: req.user.id,
      role: 'representante'
    });

    res.status(201).json({
      success: true,
      message: 'Turma criada',
      data: { _id: turma._id, name: turma.name, semester: turma.semester, role: 'representante' }
    });
  } catch (e) {
    erro(res, 400, 'Erro ao criar a turma', e);
  }
};

// @desc    Mostra o código de convite ao representante
// @route   GET /api/turmas/:id/convite
exports.verConvite = async (req, res) => {
  try {
    if ((await papelEm(req.params.id, req.user.id)) !== 'representante') {
      return erro(res, 403, 'Apenas o representante vê o convite');
    }

    const turma = await Turma.findById(req.params.id).select('+inviteCode name');
    if (!turma) return erro(res, 404, 'Turma não encontrada');

    res.status(200).json({ success: true, data: { code: turma.inviteCode } });
  } catch (e) {
    erro(res, 500, 'Erro ao buscar o convite', e);
  }
};

// @desc    Gera um convite novo, invalidando o anterior
// @route   POST /api/turmas/:id/convite/rotacionar
exports.rotacionarConvite = async (req, res) => {
  try {
    if ((await papelEm(req.params.id, req.user.id)) !== 'representante') {
      return erro(res, 403, 'Apenas o representante troca o convite');
    }

    const turma = await Turma.findById(req.params.id).select('+inviteCode');
    if (!turma) return erro(res, 404, 'Turma não encontrada');

    turma.rotateInviteCode();
    await turma.save();

    res.status(200).json({
      success: true,
      message: 'O link anterior deixou de funcionar',
      data: { code: turma.inviteCode }
    });
  } catch (e) {
    erro(res, 500, 'Erro ao trocar o convite', e);
  }
};

// @desc    Prévia da turma para quem abriu o link sem estar logado
// @route   GET /api/turmas/convite/:codigo
// @access  Público — devolve só nome e semestre, nada de membros ou conteúdo
exports.previaDoConvite = async (req, res) => {
  try {
    const turma = await Turma.findOne({ inviteCode: req.params.codigo, active: true })
      .select('name semester')
      .lean();

    if (!turma) return erro(res, 404, 'Convite inválido ou expirado');

    res.status(200).json({
      success: true,
      data: { name: turma.name, semester: turma.semester }
    });
  } catch (e) {
    erro(res, 500, 'Erro ao ler o convite', e);
  }
};

// @desc    Entra na turma usando o código do convite
// @route   POST /api/turmas/entrar
exports.entrarComConvite = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return erro(res, 400, 'Informe o código do convite');

    const turma = await Turma.findOne({ inviteCode: code, active: true }).select('name semester');
    if (!turma) return erro(res, 404, 'Convite inválido ou expirado');

    const jaEstá = await TurmaMember.findOne({ turmaId: turma._id, userId: req.user.id });
    if (jaEstá) {
      return res.status(200).json({
        success: true,
        message: 'Você já participa desta turma',
        data: { _id: turma._id, name: turma.name, role: jaEstá.role }
      });
    }

    await TurmaMember.create({ turmaId: turma._id, userId: req.user.id, role: 'aluno' });

    res.status(201).json({
      success: true,
      message: `Você entrou em ${turma.name}`,
      data: { _id: turma._id, name: turma.name, semester: turma.semester, role: 'aluno' }
    });
  } catch (e) {
    erro(res, 500, 'Erro ao entrar na turma', e);
  }
};

// @desc    Membros da turma
// @route   GET /api/turmas/:id/membros
exports.listarMembros = async (req, res) => {
  try {
    const papel = await papelEm(req.params.id, req.user.id);
    if (!papel) {
      return erro(res, 403, 'Você não participa desta turma');
    }
    // LGPD, minimização: o e-mail serve a quem administra a turma; os colegas
    // se reconhecem pelo nome.
    const mostraEmail = papel === 'representante';

    const membros = await TurmaMember.find({ turmaId: req.params.id })
      .populate('userId', 'name email')
      .sort({ role: 1 })
      .lean();

    // Nome, email e papel. Nota e falta não passam por aqui: são do aluno.
    const data = membros
      .filter((m) => m.userId)
      .map((m) => ({
        _id: m.userId._id,
        name: m.userId.name,
        ...(mostraEmail && { email: m.userId.email }),
        role: m.role,
        joinedAt: m.joinedAt
      }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (e) {
    erro(res, 500, 'Erro ao listar os membros', e);
  }
};

// @desc    Remove alguém da turma
// @route   DELETE /api/turmas/:id/membros/:userId
exports.removerMembro = async (req, res) => {
  try {
    const { id: turmaId, userId } = req.params;

    if ((await papelEm(turmaId, req.user.id)) !== 'representante') {
      return erro(res, 403, 'Apenas o representante remove membros');
    }
    if (userId === req.user.id) {
      return erro(res, 400, 'O representante não pode se remover da própria turma');
    }

    const r = await TurmaMember.deleteOne({ turmaId, userId });
    if (r.deletedCount === 0) return erro(res, 404, 'Essa pessoa não está na turma');

    // O histórico de presença e nota continua no banco, ligado ao aluno.
    res.status(200).json({ success: true, message: 'Removido da turma' });
  } catch (e) {
    erro(res, 500, 'Erro ao remover o membro', e);
  }
};

// @desc    Estado do link publico de leitura
// @route   GET /api/turmas/:id/compartilhamento
exports.verCompartilhamento = async (req, res) => {
  try {
    if ((await papelEm(req.params.id, req.user.id)) !== 'representante') {
      return erro(res, 403, 'Apenas o representante gerencia o link');
    }

    const turma = await Turma.findById(req.params.id).select('+shareToken');
    if (!turma) return erro(res, 404, 'Turma não encontrada');

    res.status(200).json({
      success: true,
      data: { ativo: Boolean(turma.shareToken), token: turma.shareToken || null }
    });
  } catch (e) {
    erro(res, 500, 'Erro ao ler o compartilhamento', e);
  }
};

// @desc    Liga o link ou gera um novo, invalidando o anterior
// @route   POST /api/turmas/:id/compartilhamento
exports.ligarCompartilhamento = async (req, res) => {
  try {
    if ((await papelEm(req.params.id, req.user.id)) !== 'representante') {
      return erro(res, 403, 'Apenas o representante gerencia o link');
    }

    const turma = await Turma.findById(req.params.id).select('+shareToken');
    if (!turma) return erro(res, 404, 'Turma não encontrada');

    const jaTinha = Boolean(turma.shareToken);
    turma.rotateShareToken();
    await turma.save();

    res.status(200).json({
      success: true,
      message: jaTinha ? 'O link anterior deixou de funcionar' : 'Link criado',
      data: { ativo: true, token: turma.shareToken }
    });
  } catch (e) {
    erro(res, 500, 'Erro ao gerar o link', e);
  }
};

// @desc    Desliga o link; quem tiver o endereco antigo perde o acesso
// @route   DELETE /api/turmas/:id/compartilhamento
exports.desligarCompartilhamento = async (req, res) => {
  try {
    if ((await papelEm(req.params.id, req.user.id)) !== 'representante') {
      return erro(res, 403, 'Apenas o representante gerencia o link');
    }

    const turma = await Turma.findById(req.params.id).select('+shareToken');
    if (!turma) return erro(res, 404, 'Turma não encontrada');

    turma.disableSharing();
    await turma.save();

    res.status(200).json({
      success: true,
      message: 'Compartilhamento desligado',
      data: { ativo: false, token: null }
    });
  } catch (e) {
    erro(res, 500, 'Erro ao desligar o link', e);
  }
};

/** Tudo o que a exclusão apaga, carregado só quando alguém exclui. */
const modelsDaTurma = () => ({
  Turma,
  TurmaMember,
  Subject: require('../models/subject'),
  Event: require('../models/event'),
  Attendance: require('../models/attendance'),
  GradeEntry: require('../models/gradeEntry'),
  EventNote: require('../models/eventNote'),
  Material: require('../models/material'),
  Chamada: require('../models/chamada'),
  EventSuggestion: require('../models/eventSuggestion')
});

/** A turma, se existir e se a pessoa puder excluí-la; senão a resposta de erro já enviada. */
async function turmaParaExcluir(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    erro(res, 404, 'Turma não encontrada');
    return null;
  }
  const turma = await Turma.findById(req.params.id).select('name ownerId').lean();
  // Quem não participa não descobre se a turma existe.
  if (!turma || !(await papelEm(turma._id, req.user.id))) {
    erro(res, 404, 'Turma não encontrada');
    return null;
  }
  if (!podeExcluir(turma, req.user.id)) {
    erro(res, 403, 'Só quem criou a turma pode excluí-la');
    return null;
  }
  return turma;
}

// @desc    O que sai junto se a turma for excluída
// @route   GET /api/turmas/:id/exclusao
exports.previaDaExclusao = async (req, res) => {
  try {
    const turma = await turmaParaExcluir(req, res);
    if (!turma) return;
    const contagem = await contarDaTurma(turma._id, modelsDaTurma());
    res.status(200).json({ success: true, data: { nome: turma.name, contagem } });
  } catch (e) {
    erro(res, 500, 'Erro ao conferir a turma', e);
  }
};

// @desc    Exclui a turma e tudo o que é dela, para sempre
// @route   DELETE /api/turmas/:id
exports.excluirTurma = async (req, res) => {
  try {
    const turma = await turmaParaExcluir(req, res);
    if (!turma) return;

    // A confirmação vem da API também, não só da tela: uma chamada perdida ou
    // um clique errado não pode apagar a turma de todo mundo.
    if (!confereNome(req.body?.confirmacao, turma.name)) {
      return erro(res, 400, 'Digite o nome da turma para confirmar a exclusão');
    }

    const apagados = await excluirTurma(turma._id, modelsDaTurma());
    res.status(200).json({ success: true, message: 'Turma excluída', data: { apagados } });
  } catch (e) {
    erro(res, 500, 'Erro ao excluir a turma', e);
  }
};
