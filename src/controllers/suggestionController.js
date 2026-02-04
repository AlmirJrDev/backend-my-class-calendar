const EventSuggestion = require('../models/eventSuggestion');
const Event = require('../models/event');
const User = require('../models/user');

// @desc    Criar sugestão de evento (aluno)
// @route   POST /api/suggestions
// @access  Private (Student)
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

    // Se for update ou delete, verificar se evento existe
    let originalData = null;
    if ((type === 'update' || type === 'delete') && eventId) {
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Evento não encontrado'
        });
      }
      originalData = event.toObject();
    } else if ((type === 'update' || type === 'delete') && !eventId) {
      return res.status(400).json({
        success: false,
        error: 'ID do evento é obrigatório para alterações ou exclusões'
      });
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
      message: 'Sugestão enviada com sucesso! O administrador será notificado.',
      data: suggestion
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Erro ao criar sugestão',
      message: error.message
    });
  }
};

// @desc    Listar minhas sugestões (aluno)
// @route   GET /api/suggestions/my-suggestions
// @access  Private (Student)
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
      message: error.message
    });
  }
};

// @desc    Listar todas as sugestões pendentes (admin)
// @route   GET /api/suggestions/pending
// @access  Private (Admin)
exports.getPendingSuggestions = async (req, res) => {
  try {
    const suggestions = await EventSuggestion.find({ status: 'pending' })
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
      message: error.message
    });
  }
};

// @desc    Listar todas as sugestões com filtros (admin)
// @route   GET /api/suggestions/all
// @access  Private (Admin)
exports.getAllSuggestions = async (req, res) => {
  try {
    const { status, type, userId } = req.query;

    const filter = {};
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
      message: error.message
    });
  }
};

// @desc    Aprovar sugestão (admin)
// @route   POST /api/suggestions/:id/approve
// @access  Private (Admin)
exports.approveSuggestion = async (req, res) => {
  try {
    const { message } = req.body;

    const suggestion = await EventSuggestion.findById(req.params.id)
      .populate('userId', 'name email');

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        error: 'Sugestão não encontrada'
      });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Esta sugestão já foi processada'
      });
    }

    let event = null;

    // Executar ação baseada no tipo
    try {
      switch (suggestion.type) {
        case 'new':
          // Criar novo evento
          event = await Event.create({
            ...suggestion.suggestionData,
            userId: req.user.id // Evento pertence ao admin
          });
          break;

        case 'update':
          // Atualizar evento existente
          if (!suggestion.eventId) {
            throw new Error('ID do evento não encontrado');
          }
          event = await Event.findByIdAndUpdate(
            suggestion.eventId,
            suggestion.suggestionData,
            { new: true, runValidators: true }
          );
          if (!event) {
            throw new Error('Evento não encontrado para atualização');
          }
          break;

        case 'delete':
          // Deletar evento
          if (!suggestion.eventId) {
            throw new Error('ID do evento não encontrado');
          }
          const deletedEvent = await Event.findByIdAndDelete(suggestion.eventId);
          if (!deletedEvent) {
            throw new Error('Evento não encontrado para exclusão');
          }
          event = { deleted: true, ...deletedEvent.toObject() };
          break;
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
      message: error.message
    });
  }
};

// @desc    Rejeitar sugestão (admin)
// @route   POST /api/suggestions/:id/reject
// @access  Private (Admin)
exports.rejectSuggestion = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Mensagem de rejeição é obrigatória'
      });
    }

    const suggestion = await EventSuggestion.findById(req.params.id)
      .populate('userId', 'name email');

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        error: 'Sugestão não encontrada'
      });
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
      message: error.message
    });
  }
};

// @desc    Obter detalhes de uma sugestão
// @route   GET /api/suggestions/:id
// @access  Private
exports.getSuggestion = async (req, res) => {
  try {
    const suggestion = await EventSuggestion.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('eventId')
      .populate('adminResponse.respondedBy', 'name email');

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        error: 'Sugestão não encontrada'
      });
    }

    // Aluno só pode ver suas próprias sugestões
    if (req.user.role !== 'admin' && suggestion.userId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    res.status(200).json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar sugestão',
      message: error.message
    });
  }
};

// @desc    Deletar sugestão (apenas próprio aluno ou admin)
// @route   DELETE /api/suggestions/:id
// @access  Private
exports.deleteSuggestion = async (req, res) => {
  try {
    const suggestion = await EventSuggestion.findById(req.params.id);

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        error: 'Sugestão não encontrada'
      });
    }

    // Verificar permissão
    if (req.user.role !== 'admin' && suggestion.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
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
      message: error.message
    });
  }
};