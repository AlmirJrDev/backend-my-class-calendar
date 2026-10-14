const User = require('../models/user');
const {
  termosPendentes,
  registroDeAceite,
  confereEmail,
  exportarDados,
  excluirConta,
  turmasQueImpedem,
  VERSAO_DOS_TERMOS
} = require('../services/contaService');

const erro = (res, status, mensagem, e) =>
  res.status(status).json({
    success: false,
    error: mensagem,
    ...(process.env.NODE_ENV === 'development' && e && { message: e.message })
  });

/** Tudo o que a conta lê ou apaga, carregado só quando usado. */
const models = () => ({
  User,
  Turma: require('../models/turma'),
  TurmaMember: require('../models/turmaMember'),
  Attendance: require('../models/attendance'),
  GradeEntry: require('../models/gradeEntry'),
  EventSuggestion: require('../models/eventSuggestion'),
  EventNote: require('../models/eventNote'),
  Material: require('../models/material'),
  Chamada: require('../models/chamada')
});

// @desc    A pessoa precisa aceitar a versão atual dos termos?
// @route   GET /api/conta/termos
exports.situacaoDosTermos = async (req, res) => {
  try {
    const usuario = await User.findById(req.user.id).select('termosAceitos').lean();
    res.status(200).json({
      success: true,
      data: { pendente: termosPendentes(usuario), versao: VERSAO_DOS_TERMOS, aceitos: usuario?.termosAceitos ?? null }
    });
  } catch (e) {
    erro(res, 500, 'Erro ao consultar os termos', e);
  }
};

// @desc    Aceita a versão atual dos Termos de Uso e da Política de Privacidade
// @route   POST /api/conta/termos
exports.aceitarTermos = async (req, res) => {
  try {
    if (req.body?.aceito !== true) return erro(res, 400, 'Marque que você leu e aceita os termos');
    await User.updateOne({ _id: req.user.id }, { $set: { termosAceitos: registroDeAceite() } });
    res.status(200).json({ success: true, data: { versao: VERSAO_DOS_TERMOS } });
  } catch (e) {
    erro(res, 500, 'Erro ao registrar o aceite', e);
  }
};

// @desc    Os dados da pessoa, para baixar (LGPD: acesso e portabilidade)
// @route   GET /api/conta/meus-dados
exports.meusDados = async (req, res) => {
  try {
    const dados = await exportarDados(req.user.id, models());
    res.status(200).json({ success: true, data: dados });
  } catch (e) {
    erro(res, 500, 'Erro ao reunir os seus dados', e);
  }
};

// @desc    Exclui a conta e os dados pessoais, para sempre (LGPD: eliminação)
// @route   DELETE /api/conta
exports.excluirMinhaConta = async (req, res) => {
  try {
    if (!confereEmail(req.body?.confirmacao, req.user.email)) {
      return erro(res, 400, 'Digite o e-mail da sua conta para confirmar a exclusão');
    }

    // Excluir a conta deixaria a turma sem dono, e só o dono exclui a turma.
    const donas = await turmasQueImpedem(req.user.id, models());
    if (donas.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Você criou turmas que ainda existem. Exclua essas turmas antes de excluir a conta.',
        turmas: donas.map((t) => ({ _id: t._id, nome: t.name }))
      });
    }

    const apagados = await excluirConta(req.user.id, models());
    res.status(200).json({ success: true, message: 'Conta excluída', data: { apagados } });
  } catch (e) {
    erro(res, 500, 'Erro ao excluir a conta', e);
  }
};
