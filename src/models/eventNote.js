const mongoose = require('mongoose');

/**
 * Observação de um membro da turma sobre um evento — "o professor disse que
 * cai do capítulo 3 ao 5". Entra na hora, sem aprovação: o valor está em ser
 * rápida. Quem escreveu e o representante podem apagar.
 */
const eventNoteSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    },
    // Copiado do evento, para as consultas filtrarem por turma como o resto.
    turmaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Turma',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: [true, 'Escreva a observação'],
      trim: true,
      maxlength: [500, 'A observação pode ter até 500 caracteres']
    }
  },
  { timestamps: true }
);

eventNoteSchema.index({ eventId: 1, createdAt: 1 });

module.exports = mongoose.model('EventNote', eventNoteSchema);
