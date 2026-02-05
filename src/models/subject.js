const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'O nome da matéria é obrigatório'],
    trim: true
  },
  teacher: {
    type: String,
    required: [true, 'O nome do professor é obrigatório'],
    trim: true
  },
  color: {
    type: String,
    default: '#3b82f6', // Cor padrão azul
    trim: true
  },
  // Configuração das aulas por dia da semana
  schedule: [
    {
      dayOfWeek: {
        type: Number,
        required: true,
        min: 0, // 0 = Domingo
        max: 6, // 6 = Sábado
        validate: {
          validator: Number.isInteger,
          message: 'O dia da semana deve ser um número inteiro entre 0 e 6'
        }
      },
      periods: {
        type: [Number],
        required: true,
        validate: {
          validator: function(periods) {
            // Verifica se todos os períodos são entre 1 e 5
            return periods.length > 0 && periods.every(p => p >= 1 && p <= 5);
          },
          message: 'Os períodos devem estar entre 1 e 5 e ter pelo menos um período'
        }
      }
    }
  ],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'O ID do usuário é obrigatório']
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índices para melhorar performance
subjectSchema.index({ userId: 1 });
subjectSchema.index({ userId: 1, active: 1 });
subjectSchema.index({ 'schedule.dayOfWeek': 1 });

// Validação customizada para evitar duplicação de dias
subjectSchema.pre('validate', function(next) {
  if (this.schedule && this.schedule.length > 0) {
    const days = this.schedule.map(s => s.dayOfWeek);
    const uniqueDays = [...new Set(days)];
    
    if (days.length !== uniqueDays.length) {
      next(new Error('Não é permitido ter o mesmo dia da semana repetido'));
    }
  }
  next();
});

// Método para obter a grade horária formatada
subjectSchema.methods.getFormattedSchedule = function() {
  const daysOfWeekMap = {
    0: 'Domingo',
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado'
  };

  return this.schedule.map(s => ({
    day: daysOfWeekMap[s.dayOfWeek],
    dayNumber: s.dayOfWeek,
    periods: s.periods.sort((a, b) => a - b)
  }));
};

module.exports = mongoose.model('Subject', subjectSchema);