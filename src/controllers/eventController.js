const Event = require('../models/event');

// @desc    Obter todos os eventos (público para visualização)
// @route   GET /api/events
// @access  Private
exports.getEvents = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    // Construir filtro base
    // Se for admin, mostra seus eventos
    // Se for aluno, mostra TODOS os eventos (do admin)
    const filter = req.user.role === 'admin' 
      ? { userId: req.user.id }
      : {}; // Alunos veem todos os eventos
    
    // Adicionar filtros opcionais
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (type) {
      filter.type = type;
    }

    const events = await Event.find(filter).sort({ date: 1, time: 1 });
    
    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar eventos',
      message: error.message
    });
  }
};

// @desc    Obter um evento específico
// @route   GET /api/events/:id
// @access  Private
exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Evento não encontrado'
      });
    }

    // Admin pode ver seus eventos, alunos podem ver qualquer evento
    if (req.user.role === 'admin' && event.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar evento',
      message: error.message
    });
  }
};

// @desc    Criar novo evento (APENAS ADMIN)
// @route   POST /api/events
// @access  Private (Admin)
exports.createEvent = async (req, res) => {
  try {
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Apenas administradores podem criar eventos. Use o sistema de sugestões para propor novos eventos.'
      });
    }

    // Adicionar userId ao corpo da requisição
    req.body.userId = req.user.id;

    const event = await Event.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Evento criado com sucesso',
      data: event
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Erro ao criar evento',
      message: error.message
    });
  }
};

// @desc    Atualizar evento (APENAS ADMIN)
// @route   PUT /api/events/:id
// @access  Private (Admin)
exports.updateEvent = async (req, res) => {
  try {
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Apenas administradores podem atualizar eventos. Use o sistema de sugestões para propor alterações.'
      });
    }

    let event = await Event.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Evento não encontrado'
      });
    }

    event = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Evento atualizado com sucesso',
      data: event
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Erro ao atualizar evento',
      message: error.message
    });
  }
};

// @desc    Deletar evento (APENAS ADMIN)
// @route   DELETE /api/events/:id
// @access  Private (Admin)
exports.deleteEvent = async (req, res) => {
  try {
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Apenas administradores podem deletar eventos. Use o sistema de sugestões para propor a remoção.'
      });
    }

    const event = await Event.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Evento não encontrado'
      });
    }

    await Event.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Evento deletado com sucesso',
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao deletar evento',
      message: error.message
    });
  }
};

// @desc    Marcar/desmarcar evento como concluído (APENAS ADMIN)
// @route   PATCH /api/events/:id/toggle-complete
// @access  Private (Admin)
exports.toggleComplete = async (req, res) => {
  try {
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Apenas administradores podem marcar eventos como concluídos'
      });
    }

    const event = await Event.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Evento não encontrado'
      });
    }

    event.completed = !event.completed;
    await event.save();

    res.status(200).json({
      success: true,
      message: `Evento marcado como ${event.completed ? 'concluído' : 'não concluído'}`,
      data: event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar evento',
      message: error.message
    });
  }
};

// @desc    Obter eventos do mês
// @route   GET /api/events/month/:year/:month
// @access  Private
exports.getEventsByMonth = async (req, res) => {
  try {
    const { year, month } = req.params;
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Alunos veem todos os eventos, admin vê apenas os seus
    const filter = req.user.role === 'admin'
      ? { userId: req.user.id }
      : {};

    filter.date = {
      $gte: startDate,
      $lte: endDate
    };

    const events = await Event.find(filter).sort({ date: 1, time: 1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar eventos do mês',
      message: error.message
    });
  }
};