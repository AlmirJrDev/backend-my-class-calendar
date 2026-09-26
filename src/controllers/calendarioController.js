const crypto = require('crypto');
const User = require('../models/user');
const Turma = require('../models/turma');
const TurmaMember = require('../models/turmaMember');
const Event = require('../models/event');
const { gerarCalendario } = require('../services/icsService');

const erro = (res, status, mensagem, e) =>
  res.status(status).json({
    success: false,
    error: mensagem,
    ...(e && process.env.NODE_ENV === 'development' && { message: e.message })
  });

/** Quanto do passado entra na assinatura: o bastante para rever o semestre. */
const DIAS_PASSADOS = 60;

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{20,64}$/;

const novoToken = () => crypto.randomBytes(24).toString('base64url');

// @desc    Link de assinatura do calendário da pessoa (cria na primeira vez)
// @route   GET /api/calendario/assinatura
// @access  Com sessão
exports.meuLink = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+calendarToken');
    if (!user) return erro(res, 404, 'Usuário não encontrado');

    if (!user.calendarToken) {
      user.calendarToken = novoToken();
      await user.save();
    }

    res.status(200).json({ success: true, data: { token: user.calendarToken } });
  } catch (e) {
    erro(res, 500, 'Erro ao gerar o link do calendário', e);
  }
};

// @desc    Trocar o link: o anterior para de funcionar
// @route   POST /api/calendario/assinatura/rotacionar
// @access  Com sessão
exports.rotacionar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+calendarToken');
    if (!user) return erro(res, 404, 'Usuário não encontrado');

    user.calendarToken = novoToken();
    await user.save();

    res.status(200).json({ success: true, data: { token: user.calendarToken } });
  } catch (e) {
    erro(res, 500, 'Erro ao trocar o link do calendário', e);
  }
};

// @desc    O calendário em si, no formato que Google Agenda e iPhone assinam
// @route   GET /api/calendario/:token.ics
// @access  Público — o segredo é o token. Sem notas, faltas nem observações.
exports.feed = async (req, res) => {
  try {
    const { token } = req.params;
    if (!TOKEN_VALIDO.test(token)) return res.status(404).type('text/plain').send('Calendário não encontrado');

    const user = await User.findOne({ calendarToken: token }).select('_id');
    if (!user) return res.status(404).type('text/plain').send('Calendário não encontrado');

    const vinculos = await TurmaMember.find({ userId: user._id }).select('turmaId').lean();
    const turmas = await Turma.find({ _id: { $in: vinculos.map((v) => v.turmaId) }, active: true })
      .select('name')
      .lean();

    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_PASSADOS);

    const eventos = await Event.find({ turmaId: { $in: turmas.map((t) => t._id) }, date: { $gte: desde } })
      .select('title type date time endTime location subject description recurring daysOfWeek turmaId createdAt updatedAt')
      .sort({ date: 1 })
      .lean();

    // Com mais de uma turma, o título diz de qual é ("Cursinho · Prova: ...").
    const nomeDa = new Map(turmas.map((t) => [String(t._id), t.name]));
    const variasTurmas = turmas.length > 1;
    const comTurma = eventos.map((e) => ({
      ...e,
      turmaNome: variasTurmas ? nomeDa.get(String(e.turmaId)) : undefined
    }));

    const ics = gerarCalendario(comTurma, {
      nome: turmas.length === 1 ? turmas[0].name : 'My Class Calendar',
      linkDoApp: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/dashboard` : undefined
    });

    res
      .status(200)
      .set({
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="my-class-calendar.ics"',
        // Privado: a URL é secreta, e nenhum cache no caminho deve guardá-la.
        'Cache-Control': 'private, max-age=300'
      })
      .send(ics);
  } catch (e) {
    console.error('[calendario] falha ao gerar o feed:', e.message);
    res.status(500).type('text/plain').send('Erro ao gerar o calendário');
  }
};
