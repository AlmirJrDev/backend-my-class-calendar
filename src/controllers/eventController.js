const Event = require('../models/event');
const { filtroDeTurma, pertenceAoUsuario } = require('../middleware/turma');

// @desc    Obter todos os eventos (público para visualização)
// @route   GET /api/events
// @access  Membros da turma
exports.getEvents = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    // Só as turmas de que a pessoa participa.
    const filter = filtroDeTurma(req);
    
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
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Obter um evento específico
// @route   GET /api/events/:id
// @access  Membros da turma
exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Evento não encontrado'
      });
    }

    if (!pertenceAoUsuario(req, event)) {
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
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
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

    // Sem turma o registro nasce invisível: nenhuma leitura o alcança.
    if (!req.turmaIds || req.turmaIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Você precisa pertencer a uma turma para criar'
      });
    }

    req.body.userId = req.user.id;
    req.body.turmaId = req.turmaIds[0];

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
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
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
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
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
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
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
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Obter eventos do mês
// @route   GET /api/events/month/:year/:month
// @access  Membros da turma
exports.getEventsByMonth = async (req, res) => {
  try {
    const { year, month } = req.params;
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const filter = filtroDeTurma(req);

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
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};