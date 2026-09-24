const mongoose = require('mongoose');

/**
 * Aviso de que o professor está fazendo chamada agora. É um sinal dado por
 * quem está na sala — e não a hora em que alguém marcou presença, que não
 * serve: metade dos registros de presença nasce preenchida em lote.
 *
 * Um aviso por matéria/período/dia: o segundo toque não conta de novo, para a
 * média não pender pela turma inteira avisando junto.
 */
const chamadaSchema = new mongoose.Schema(
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
      required: true
    },
    period: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    /** Dia do aviso, à meia-noite, para a chave única do dia. */
    dia: {
      type: Date,
      required: true
    },
    /** Minutos desde a meia-noite: é assim que a média é calculada. */
    minutoDoDia: {
      type: Number,
      required: true,
      min: 0,
      max: 1439
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

chamadaSchema.index({ turmaId: 1, subjectId: 1, dia: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('Chamada', chamadaSchema);
