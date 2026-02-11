const Attendance = require('../models/attendance');
const Subject = require('../models/subject');

// @desc    Registrar presença/falta
// @route   POST /api/attendance
// @access  Private
exports.recordAttendance = async (req, res) => {
  try {
    const { subjectId, date, period, isPresent, notes } = req.body;

    // Validar campos obrigatórios
    if (!subjectId || !date || !period) {
      return res.status(400).json({
        success: false,
        error: 'SubjectId, data e período são obrigatórios'
      });
    }

    // Verificar se a matéria existe
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Matéria não encontrada'
      });
    }

    // Verificar se já existe registro para essa data/período
    const existingAttendance = await Attendance.findOne({
      userId: req.user.id,
      subjectId,
      date: new Date(date),
      period
    });

    if (existingAttendance) {
      // Atualizar registro existente
      existingAttendance.isPresent = isPresent ?? false;
      existingAttendance.notes = notes;
      await existingAttendance.save();

      return res.status(200).json({
        success: true,
        message: 'Registro de presença atualizado',
        data: existingAttendance
      });
    }

    // Criar novo registro
    const attendance = await Attendance.create({
      userId: req.user.id,
      subjectId,
      date,
      period,
      isPresent: isPresent ?? false,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Presença registrada com sucesso',
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao registrar presença',
      message: error.message
    });
  }
};

// @desc    Registrar múltiplas faltas/presenças
// @route   POST /api/attendance/bulk
// @access  Private
exports.bulkRecordAttendance = async (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Forneça um array de registros'
      });
    }

    const results = [];
    const errors = [];

    for (const record of records) {
      try {
        const { subjectId, date, period, isPresent, notes } = record;

        const existingAttendance = await Attendance.findOne({
          userId: req.user.id,
          subjectId,
          date: new Date(date),
          period
        });

        if (existingAttendance) {
          existingAttendance.isPresent = isPresent ?? false;
          existingAttendance.notes = notes;
          await existingAttendance.save();
          results.push(existingAttendance);
        } else {
          const attendance = await Attendance.create({
            userId: req.user.id,
            subjectId,
            date,
            period,
            isPresent: isPresent ?? false,
            notes
          });
          results.push(attendance);
        }
      } catch (error) {
        errors.push({
          record,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `${results.length} registros processados`,
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao registrar presenças em lote',
      message: error.message
    });
  }
};

// @desc    Obter estatísticas de presença de uma matéria
// @route   GET /api/attendance/stats/:subjectId
// @access  Private
exports.getSubjectStats = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Matéria não encontrada'
      });
    }

    const stats = await Attendance.getAttendanceStats(req.user.id, subjectId);

    res.status(200).json({
      success: true,
      data: {
        subjectId,
        subjectName: subject.name,
        subjectColor: subject.color,
        ...stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas',
      message: error.message
    });
  }
};

// @desc    Obter estatísticas de todas as matérias do usuário
// @route   GET /api/attendance/stats
// @access  Private
exports.getAllStats = async (req, res) => {
  try {
    const stats = await Attendance.getAllUserStats(req.user.id);

    // Ordenar por taxa de presença (matérias em risco primeiro)
    stats.sort((a, b) => {
      if (a.isAtRisk && !b.isAtRisk) return -1;
      if (!a.isAtRisk && b.isAtRisk) return 1;
      return a.attendanceRate - b.attendanceRate;
    });

    res.status(200).json({
      success: true,
      count: stats.length,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas',
      message: error.message
    });
  }
};

// @desc    Obter histórico de presenças de uma matéria
// @route   GET /api/attendance/history/:subjectId
// @access  Private
exports.getSubjectHistory = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { startDate, endDate, isPresent } = req.query;

    const filter = {
      userId: req.user.id,
      subjectId
    };

    // Filtrar por data
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Filtrar por presença/falta
    if (isPresent !== undefined) {
      filter.isPresent = isPresent === 'true';
    }

    const history = await Attendance.find(filter)
      .populate('subjectId', 'name teacher color')
      .sort({ date: -1, period: 1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar histórico',
      message: error.message
    });
  }
};

// @desc    Obter todo o histórico de presenças do usuário
// @route   GET /api/attendance/history
// @access  Private
exports.getAllHistory = async (req, res) => {
  try {
    const { startDate, endDate, isPresent } = req.query;

    const filter = { userId: req.user.id };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (isPresent !== undefined) {
      filter.isPresent = isPresent === 'true';
    }

    const history = await Attendance.find(filter)
      .populate('subjectId', 'name teacher color')
      .sort({ date: -1, period: 1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar histórico',
      message: error.message
    });
  }
};

// @desc    Atualizar registro de presença
// @route   PUT /api/attendance/:id
// @access  Private
exports.updateAttendance = async (req, res) => {
  try {
    const { isPresent, notes } = req.body;

    let attendance = await Attendance.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Registro não encontrado'
      });
    }

    attendance.isPresent = isPresent ?? attendance.isPresent;
    attendance.notes = notes !== undefined ? notes : attendance.notes;

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Registro atualizado com sucesso',
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar registro',
      message: error.message
    });
  }
};

// @desc    Deletar registro de presença
// @route   DELETE /api/attendance/:id
// @access  Private
exports.deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Registro não encontrado'
      });
    }

    await Attendance.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Registro deletado com sucesso',
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao deletar registro',
      message: error.message
    });
  }
};

// @desc    Obter matérias em risco de reprovação por falta
// @route   GET /api/attendance/at-risk
// @access  Private
exports.getAtRiskSubjects = async (req, res) => {
  try {
    const allStats = await Attendance.getAllUserStats(req.user.id);
    const atRisk = allStats.filter(stat => stat.isAtRisk);

    res.status(200).json({
      success: true,
      count: atRisk.length,
      data: atRisk
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar matérias em risco',
      message: error.message
    });
  }
};

// @desc    Obter resumo geral de presenças
// @route   GET /api/attendance/summary
// @access  Private
exports.getSummary = async (req, res) => {
  try {
    const allStats = await Attendance.getAllUserStats(req.user.id);
    
    const summary = {
      totalSubjects: allStats.length,
      subjectsAtRisk: allStats.filter(s => s.isAtRisk).length,
      totalClasses: allStats.reduce((sum, s) => sum + s.totalClasses, 0),
      totalAbsences: allStats.reduce((sum, s) => sum + s.absences, 0),
      totalPresences: allStats.reduce((sum, s) => sum + s.presences, 0),
      averageAttendanceRate: allStats.length > 0
        ? Math.round((allStats.reduce((sum, s) => sum + s.attendanceRate, 0) / allStats.length) * 100) / 100
        : 0,
      subjects: allStats
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar resumo',
      message: error.message
    });
  }
};