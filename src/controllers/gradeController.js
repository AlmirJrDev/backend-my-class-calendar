const GradeEntry   = require('../models/gradeEntry');
const Subject      = require('../models/subject');
const gradeService = require('../services/gradeService');

// @desc    Salvar/atualizar notas do aluno em uma matéria
// @route   PUT /api/grades/:subjectId
// @access  Private
exports.saveGrades = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { grades }    = req.body; // { P1: 7.5, AD: 8.0, P2: null }

    if (!grades || typeof grades !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Informe as notas no formato { "P1": 7.5, "AD": null }'
      });
    }

    // Buscar matéria e validar que gradeFormula existe
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ success: false, error: 'Matéria não encontrada' });
    }
    if (!subject.gradeFormula || subject.gradeFormula.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Esta matéria ainda não possui fórmula de média cadastrada'
      });
    }

    // Validar que as chaves enviadas existem na fórmula
    const validKeys = new Set(subject.gradeFormula.map(i => i.key));
    const invalidKeys = Object.keys(grades).filter(k => !validKeys.has(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Chaves inválidas: ${invalidKeys.join(', ')}. Válidas: ${[...validKeys].join(', ')}`
      });
    }

    // Validar range das notas
    for (const [key, value] of Object.entries(grades)) {
      if (value !== null && value !== undefined) {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 10) {
          return res.status(400).json({
            success: false,
            error: `Nota de "${key}" inválida: deve ser entre 0 e 10 ou null`
          });
        }
      }
    }

    // Upsert — cria ou atualiza (um registro por aluno por matéria)
    const entry = await GradeEntry.findOneAndUpdate(
      { subjectId, userId: req.user.id },
      {
        $set: Object.fromEntries(
          Object.entries(grades).map(([k, v]) => [`grades.${k}`, v !== undefined ? v : null])
        )
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Calcular e retornar simulação já junto
    const gradesObj  = Object.fromEntries(entry.grades);
    const simulation = gradeService.calculateGrade(subject, gradesObj);

    res.status(200).json({
      success: true,
      message: 'Notas salvas com sucesso',
      data: {
        entry,
        simulation
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro ao salvar notas', ...(process.env.NODE_ENV === 'development' && { message: error.message }) });
  }
};

// @desc    Obter notas do aluno + simulação de média
// @route   GET /api/grades/:subjectId
// @access  Private
exports.getGrades = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ success: false, error: 'Matéria não encontrada' });
    }

    const entry = await GradeEntry.findOne({ subjectId, userId: req.user.id });

    // Se ainda não tem notas, retorna simulação zerada
    const gradesObj  = entry ? Object.fromEntries(entry.grades) : {};
    const simulation = subject.gradeFormula?.length > 0
      ? gradeService.calculateGrade(subject, gradesObj)
      : null;

    res.status(200).json({
      success: true,
      data: {
        entry: entry || null,
        simulation
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro ao buscar notas', ...(process.env.NODE_ENV === 'development' && { message: error.message }) });
  }
};

// @desc    Limpar uma nota específica (setar null)
// @route   DELETE /api/grades/:subjectId/:gradeKey
// @access  Private
exports.clearGrade = async (req, res) => {
  try {
    const { subjectId, gradeKey } = req.params;

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ success: false, error: 'Matéria não encontrada' });
    }

    const validKeys = subject.gradeFormula?.map(i => i.key) || [];
    if (!validKeys.includes(gradeKey)) {
      return res.status(400).json({ success: false, error: `Chave "${gradeKey}" não existe nesta matéria` });
    }

    const entry = await GradeEntry.findOneAndUpdate(
      { subjectId, userId: req.user.id },
      { $set: { [`grades.${gradeKey}`]: null } },
      { new: true }
    );

    if (!entry) {
      return res.status(404).json({ success: false, error: 'Nenhuma nota encontrada para esta matéria' });
    }

    const gradesObj  = Object.fromEntries(entry.grades);
    const simulation = gradeService.calculateGrade(subject, gradesObj);

    res.status(200).json({
      success: true,
      message: `Nota "${gradeKey}" removida`,
      data: { entry, simulation }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro ao limpar nota', ...(process.env.NODE_ENV === 'development' && { message: error.message }) });
  }
};