const mongoose = require('mongoose');
const EventSuggestion = require('../models/eventSuggestion');
const Event = require('../models/event');
const EventNote = require('../models/eventNote');
const Material = require('../models/material');
// Sem uso direto: carregar o model o registra, e o populate('userId') precisa dele.
require('../models/user');
const {
  turmasQueModera,
  podeModerar,
  podeVer,
  turmaDaNovaSugestao,
  camposDoEventoDaSugestao
} = require('../services/sugestaoService');

// Sugestão de outra turma responde 404, igual a uma que não existe: um 403
// confirmaria que o id é de verdade.
const naoEncontrada = (res) =>
  res.status(404).json({ success: false, error: 'Sugestão não encontrada' });

const idInvalido = (id) => !mongoose.isValidObjectId(id);

// @desc    Criar sugestão de evento (aluno)
// @route   POST /api/suggestions
// @access  Private (aluno da turma)
exports.createSuggestion = async (req, res) => {
  try {
    const { type, eventId, suggestionData, reason } = req.body;

    // Validar campos obrigatórios
    if (!type || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Tipo e motivo da sugestão são obrigatórios'
      });
    }

    // Validar tipo de sugestão
    if (!['new', 'update', 'delete'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de sugestão inválido. Use: new, update ou delete'
      });
    }

    // A sugestão nasce numa turma só: é nela que o representante vai aprovar.
    const { turmaId, erro } = turmaDaNovaSugestao(req);
    if (erro) {
      return res.status(400).json({ success: false, error: erro });
    }

    // Se for update ou delete, o evento precisa ser desta turma. Sem essa
    // conferência dava para apontar o evento de outra turma e ainda receber os
    // dados dele de volta em originalData.
    let originalData = null;
    if (type === 'update' || type === 'delete') {
      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: 'ID do evento é obrigatório para alterações ou exclusões'
        });
      }
      const event = idInvalido(eventId) ? null : await Event.findOne({ _id: eventId, turmaId });
      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Evento não encontrado'
        });
      }
      originalData = event.toObject();
    }

    // Se for novo evento, validar dados
    if (type === 'new' && !suggestionData) {
      return res.status(400).json({
        success: false,
        error: 'Dados da sugestão são obrigatórios para novos eventos'
      });
    }

    // Criar sugestão
    const suggestion = await EventSuggestion.create({
      turmaId,
      userId: req.user.id,
      eventId: eventId || null,
      type,
      suggestionData: type !== 'delete' ? suggestionData : null,
      originalData,
      reason,
      status: 'pending'
    });

    // Popular dados do usuário
    await suggestion.populate('userId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Sugestão enviada com sucesso! O representante da turma será notificado.',
      data: suggestion
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Erro ao criar sugestão',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Listar minhas sugestões (aluno)
// @route   GET /api/suggestions/my-suggestions
// @access  Private (aluno)
exports.getMySuggestions = async (req, res) => {
  try {
    const { status, type } = req.query;

    const filter = { userId: req.user.id };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const suggestions = await EventSuggestion.find(filter)
      .populate('eventId')
      .populate('adminResponse.respondedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: suggestions.length,
      data: suggestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar sugestões',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Listar as sugestões pendentes das turmas que a pessoa modera
// @route   GET /api/suggestions/pending
// @access  Private (representante)
exports.getPendingSuggestions = async (req, res) => {
  try {
    const suggestions = await EventSuggestion.find({
      status: 'pending',
      turmaId: { $in: turmasQueModera(req) }
    })
      .populate('userId', 'name email')
      .populate('eventId')
      .sort({ createdAt: 1 }); // Mais antigas primeiro

    res.status(200).json({
      success: true,
      count: suggestions.length,
      data: suggestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar sugestões',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Listar as sugestões das turmas que a pessoa modera, com filtros
// @route   GET /api/suggestions/all
// @access  Private (representante)
exports.getAllSuggestions = async (req, res) => {
  try {
    const { status, type, userId } = req.query;

    const filter = { turmaId: { $in: turmasQueModera(req) } };
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (userId) filter.userId = userId;

    const suggestions = await EventSuggestion.find(filter)
      .populate('userId', 'name email')
      .populate('eventId')
      .populate('adminResponse.respondedBy', 'name email')
      .sort({ createdAt: -1 });

    // Estatísticas
    const stats = {
      total: suggestions.length,
      pending: suggestions.filter(s => s.status === 'pending').length,
      approved: suggestions.filter(s => s.status === 'approved').length,
      rejected: suggestions.filter(s => s.status === 'rejected').length
    };

    res.status(200).json({
      success: true,
      count: suggestions.length,
      stats,
      data: suggestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar sugestões',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Aprovar sugestão (representante da turma)
// @route   POST /api/suggestions/:id/approve
// @access  Private (representante)
exports.approveSuggestion = async (req, res) => {
  try {
    const { message } = req.body;

    if (idInvalido(req.params.id)) return naoEncontrada(res);

    const suggestion = await EventSuggestion.findById(req.params.id)
      .populate('userId', 'name email');

    if (!suggestion || !podeModerar(req, suggestion)) {
      return naoEncontrada(res);
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Esta sugestão já foi processada'
      });
    }

    const { turmaId } = suggestion;
    let event = null;

    // Executar ação baseada no tipo
    try {
      switch (suggestion.type) {
        case 'new':
          // O evento nasce na turma da sugestão. Sem turmaId ele ficava
          // invisível: toda leitura de evento filtra por turma.
          event = await Event.create({
            ...camposDoEventoDaSugestao(suggestion.suggestionData),
            turmaId,
            userId: req.user.id // Evento pertence a quem aprovou
          });
          break;

        case 'update': {
          // Só mexe em evento da mesma turma da sugestão.
          if (!suggestion.eventId) {
            throw new Error('ID do evento não encontrado');
          }
          event = await Event.findOne({ _id: suggestion.eventId, turmaId });
          if (!event) {
            throw new Error('Evento não encontrado para atualização');
          }
          // save() em vez de findByIdAndUpdate: roda também as validações do model.
          event.set(camposDoEventoDaSugestao(suggestion.suggestionData));
          await event.save();
          break;
        }

        case 'delete': {
          if (!suggestion.eventId) {
            throw new Error('ID do evento não encontrado');
          }
          const deletedEvent = await Event.findOneAndDelete({ _id: suggestion.eventId, turmaId });
          if (!deletedEvent) {
            throw new Error('Evento não encontrado para exclusão');
          }
          // Mesma limpeza da exclusão direta de evento.
          await EventNote.deleteMany({ eventId: deletedEvent._id });
          await Material.updateMany({ eventId: deletedEvent._id }, { $unset: { eventId: 1 } });
          event = { deleted: true, ...deletedEvent.toObject() };
          break;
        }
      }

      // Atualizar status da sugestão
      suggestion.status = 'approved';
      suggestion.adminResponse = {
        message: message || 'Sugestão aprovada',
        respondedAt: Date.now(),
        respondedBy: req.user.id
      };
      await suggestion.save();

      res.status(200).json({
        success: true,
        message: 'Sugestão aprovada com sucesso!',
        data: {
          suggestion,
          event
        }
      });
    } catch (eventError) {
      return res.status(400).json({
        success: false,
        error: 'Erro ao processar evento',
        message: eventError.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao aprovar sugestão',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Rejeitar sugestão (representante da turma)
// @route   POST /api/suggestions/:id/reject
// @access  Private (representante)
exports.rejectSuggestion = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Mensagem de rejeição é obrigatória'
      });
    }

    if (idInvalido(req.params.id)) return naoEncontrada(res);

    const suggestion = await EventSuggestion.findById(req.params.id)
      .populate('userId', 'name email');

    if (!suggestion || !podeModerar(req, suggestion)) {
      return naoEncontrada(res);
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Esta sugestão já foi processada'
      });
    }

    suggestion.status = 'rejected';
    suggestion.adminResponse = {
      message,
      respondedAt: Date.now(),
      respondedBy: req.user.id
    };
    await suggestion.save();

    res.status(200).json({
      success: true,
      message: 'Sugestão rejeitada',
      data: suggestion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao rejeitar sugestão',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Obter detalhes de uma sugestão
// @route   GET /api/suggestions/:id
// @access  Private (autor ou representante da turma)
exports.getSuggestion = async (req, res) => {
  try {
    if (idInvalido(req.params.id)) return naoEncontrada(res);

    const suggestion = await EventSuggestion.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('eventId')
      .populate('adminResponse.respondedBy', 'name email');

    if (!suggestion || !podeVer(req, suggestion)) {
      return naoEncontrada(res);
    }

    res.status(200).json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar sugestão',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Deletar sugestão (o próprio autor ou o representante da turma)
// @route   DELETE /api/suggestions/:id
// @access  Private
exports.deleteSuggestion = async (req, res) => {
  try {
    if (idInvalido(req.params.id)) return naoEncontrada(res);

    const suggestion = await EventSuggestion.findById(req.params.id);

    if (!suggestion || !podeVer(req, suggestion)) {
      return naoEncontrada(res);
    }

    // Só pode deletar se ainda estiver pendente
    if (suggestion.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Não é possível deletar sugestão já processada'
      });
    }

    await EventSuggestion.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Sugestão deletada com sucesso',
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao deletar sugestão',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};
