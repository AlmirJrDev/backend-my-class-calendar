const mongoose = require('mongoose');

const eventSuggestionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null // null se for novo evento
  },
  type: {
    type: String,
    enum: ['new', 'update', 'delete'],
    required: true
  },
  suggestionData: {
    title: String,
    description: String,
    date: Date,
    time: String,
    type: {
      type: String,
      enum: ['prova', 'trabalho', 'aula', 'atividade', 'evento', 'outro']
    },
    subject: String,
    location: String,
    priority: {
      type: String,
      enum: ['baixa', 'media', 'alta']
    },
    completed: {
      type: Boolean,
      default: false
    }
  },
  originalData: {
    type: mongoose.Schema.Types.Mixed,
    default: null // Dados originais do evento (para updates)
  },
  reason: {
    type: String,
    required: [true, 'Motivo da sugestão é obrigatório'],
    trim: true,
    maxlength: [500, 'Motivo não pode ter mais de 500 caracteres']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminResponse: {
    message: String,
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Atualizar updatedAt antes de salvar
eventSuggestionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Índices para melhor performance
eventSuggestionSchema.index({ status: 1, createdAt: -1 });
eventSuggestionSchema.index({ userId: 1 });
eventSuggestionSchema.index({ eventId: 1 });

module.exports = mongoose.model('EventSuggestion', eventSuggestionSchema);