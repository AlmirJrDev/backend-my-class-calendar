const mongoose = require('mongoose');

const gradeEntrySchema = new mongoose.Schema({
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'O ID da matéria é obrigatório']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'O ID do usuário é obrigatório']
  },
  // Map dinâmico: { "P1": 7.5, "AD": null, "P2": 8.0 }
  // Chaves correspondem aos `key` definidos em Subject.gradeFormula
  grades: {
    type: Map,
    of: {
      type: Number,
      min: [0, 'Nota mínima é 0'],
      max: [10, 'Nota máxima é 10'],
      default: null
    },
    default: {}
  }
}, {
  timestamps: true
});

// Cada aluno tem apenas uma entrada por matéria
gradeEntrySchema.index({ subjectId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('GradeEntry', gradeEntrySchema);