const Subject = require('../models/subject');
const { filtroDeTurma, pertenceAoUsuario } = require('../middleware/turma');

// @desc    Obter todas as matérias
// @route   GET /api/subjects
// @access  Membros da turma
exports.getSubjects = async (req, res) => {
  try {
    const { active } = req.query;
    
    // Só as turmas de que a pessoa participa.
    const filter = filtroDeTurma(req);
    
    // Filtrar por status ativo/inativo se especificado
    if (active !== undefined) {
      filter.active = active === 'true';
    }

    const subjects = await Subject.find(filter).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar matérias',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Obter uma matéria específica
// @route   GET /api/subjects/:id
// @access  Membros da turma
exports.getSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Matéria não encontrada'
      });
    }

    // Admin autenticado pode ver suas matérias, visitantes e alunos podem ver qualquer matéria
    if (!pertenceAoUsuario(req, subject)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    res.status(200).json({
      success: true,
      data: subject
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar matéria',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Criar nova matéria (APENAS ADMIN)
// @route   POST /api/subjects
// @access  Private (Admin)
exports.createSubject = async (req, res) => {
  try {
    // Adicionar userId ao corpo da requisição
    // Sem turma o registro nasce invisível: nenhuma leitura o alcança.
    if (!req.turmaIds || req.turmaIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Você precisa pertencer a uma turma para criar'
      });
    }

    req.body.userId = req.user.id;
    req.body.turmaId = req.turmaIds[0];

    const subject = await Subject.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Matéria criada com sucesso',
      data: subject
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Erro ao criar matéria',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Atualizar matéria (APENAS ADMIN)
// @route   PUT /api/subjects/:id
// @access  Private (Admin)
exports.updateSubject = async (req, res) => {
  try {
    let subject = await Subject.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Matéria não encontrada'
      });
    }

    subject = await Subject.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Matéria atualizada com sucesso',
      data: subject
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Erro ao atualizar matéria',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Deletar matéria (APENAS ADMIN)
// @route   DELETE /api/subjects/:id
// @access  Private (Admin)
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Matéria não encontrada'
      });
    }

    await Subject.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Matéria deletada com sucesso',
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao deletar matéria',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Ativar/desativar matéria (APENAS ADMIN)
// @route   PATCH /api/subjects/:id/toggle-active
// @access  Private (Admin)
exports.toggleActive = async (req, res) => {
  try {
    const subject = await Subject.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Matéria não encontrada'
      });
    }

    subject.active = !subject.active;
    await subject.save();

    res.status(200).json({
      success: true,
      message: `Matéria ${subject.active ? 'ativada' : 'desativada'} com sucesso`,
      data: subject
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar matéria',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Obter grade horária completa
// @route   GET /api/subjects/schedule/week
// @access  Membros da turma
exports.getWeekSchedule = async (req, res) => {
  try {
    const filter = { ...filtroDeTurma(req), active: true };

    const subjects = await Subject.find(filter);

    // Organizar grade horária por dia e período
    const weekSchedule = {
      0: {}, // Domingo
      1: {}, // Segunda
      2: {}, // Terça
      3: {}, // Quarta
      4: {}, // Quinta
      5: {}, // Sexta
      6: {}  // Sábado
    };

    // Preencher a grade
    subjects.forEach(subject => {
      subject.schedule.forEach(scheduleItem => {
        const day = scheduleItem.dayOfWeek;
        
        scheduleItem.periods.forEach(period => {
          if (!weekSchedule[day][period]) {
            weekSchedule[day][period] = [];
          }
          
          weekSchedule[day][period].push({
            subjectId: subject._id,
            subjectName: subject.name,
            teacher: subject.teacher,
            color: subject.color
          });
        });
      });
    });

    res.status(200).json({
      success: true,
      data: weekSchedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar grade horária',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Obter matérias por dia da semana
// @route   GET /api/subjects/day/:dayOfWeek
// @access  Membros da turma
exports.getSubjectsByDay = async (req, res) => {
  try {
    const { dayOfWeek } = req.params;
    const day = parseInt(dayOfWeek);

    if (day < 0 || day > 6) {
      return res.status(400).json({
        success: false,
        error: 'Dia da semana inválido. Use 0 (domingo) a 6 (sábado)'
      });
    }

    const filter = { ...filtroDeTurma(req), active: true, 'schedule.dayOfWeek': day };

    const subjects = await Subject.find(filter);

    // Organizar por período
    const daySchedule = {};

    subjects.forEach(subject => {
      const scheduleForDay = subject.schedule.find(s => s.dayOfWeek === day);
      
      if (scheduleForDay) {
        scheduleForDay.periods.forEach(period => {
          if (!daySchedule[period]) {
            daySchedule[period] = [];
          }
          
          daySchedule[period].push({
            subjectId: subject._id,
            subjectName: subject.name,
            teacher: subject.teacher,
            color: subject.color
          });
        });
      }
    });

    res.status(200).json({
      success: true,
      dayOfWeek: day,
      data: daySchedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar matérias do dia',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};