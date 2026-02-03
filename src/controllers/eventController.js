const Event = require('../models/event');

// @desc    Obter todos os eventos do usuário
// @route   GET /api/events
// @access  Private
exports.getEvents = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    // Construir filtro base
    const filter = { userId: req.user.id };
    
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

// @desc    Criar novo evento
// @route   POST /api/events
// @access  Private
exports.createEvent = async (req, res) => {
  try {
    // Adicionar userId ao corpo da requisição
    req.body.userId = req.user.id;

    const event = await Event.create(req.body);

    res.status(201).json({
      success: true,
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

// @desc    Atualizar evento
// @route   PUT /api/events/:id
// @access  Private
exports.updateEvent = async (req, res) => {
  try {
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

// @desc    Deletar evento
// @route   DELETE /api/events/:id
// @access  Private
exports.deleteEvent = async (req, res) => {
  try {
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

// @desc    Marcar/desmarcar evento como concluído
// @route   PATCH /api/events/:id/toggle-complete
// @access  Private
exports.toggleComplete = async (req, res) => {
  try {
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

    const events = await Event.find({
      userId: req.user.id,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: 1, time: 1 });

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