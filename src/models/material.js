const mongoose = require('mongoose');

/**
 * Material de estudo da turma: um link para slides, lista, PDF no Drive,
 * vídeo. Só link — sem upload, então nada de arquivo para guardar nem pagar.
 */
const materialSchema = new mongoose.Schema(
  {
    turmaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Turma',
      required: true,
      index: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Escolha a matéria']
    },
    // Opcional: o material é de uma prova específica ("lista da P1").
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    title: {
      type: String,
      required: [true, 'Dê um nome ao material'],
      trim: true,
      maxlength: [120, 'O nome pode ter até 120 caracteres']
    },
    url: {
      type: String,
      required: [true, 'Cole o link'],
      trim: true,
      maxlength: [2000, 'Link muito longo']
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

materialSchema.index({ turmaId: 1, subjectId: 1, createdAt: -1 });

module.exports = mongoose.model('Material', materialSchema);
