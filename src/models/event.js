const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'O título é obrigatório'],
    trim: true
  },
  type: {
    type: String,
    enum: ['class', 'assignment', 'exam'],
    required: [true, 'O tipo de evento é obrigatório']
  },
  date: {
    type: Date,
    required: [true, 'A data é obrigatória']
  },
  time: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  recurring: {
    type: Boolean,
    default: false
  },
  daysOfWeek: {
    type: [Number],
    validate: {
      validator: function(days) {
        return days.every(day => day >= 0 && day <= 6);
      },
      message: 'Os dias da semana devem estar entre 0 (domingo) e 6 (sábado)'
    }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'O ID do usuário é obrigatório']
  },
  completed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Índice para melhorar performance nas buscas
eventSchema.index({ userId: 1, date: 1 });
eventSchema.index({ userId: 1, type: 1 });

// Middleware para validar daysOfWeek apenas quando recurring é true
eventSchema.pre('validate', function(next) {
  if (this.recurring && (!this.daysOfWeek || this.daysOfWeek.length === 0)) {
    next(new Error('Eventos recorrentes devem ter pelo menos um dia da semana selecionado'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Event', eventSchema);