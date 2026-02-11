const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'O ID do usuário é obrigatório']
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'O ID da matéria é obrigatório']
  },
  date: {
    type: Date,
    required: [true, 'A data é obrigatória'],
    default: Date.now
  },
  period: {
    type: Number,
    required: [true, 'O período é obrigatório'],
    min: 1,
    max: 5
  },
  isPresent: {
    type: Boolean,
    required: true,
    default: false // false = falta, true = presença
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Índices compostos para melhor performance e evitar duplicações
attendanceSchema.index({ userId: 1, subjectId: 1 });
attendanceSchema.index({ userId: 1, subjectId: 1, date: 1, period: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

// Método estático para calcular estatísticas de presença
attendanceSchema.statics.getAttendanceStats = async function(userId, subjectId) {
  const stats = await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        subjectId: mongoose.Types.ObjectId(subjectId)
      }
    },
    {
      $group: {
        _id: null,
        totalClasses: { $sum: 1 },
        absences: {
          $sum: {
            $cond: [{ $eq: ['$isPresent', false] }, 1, 0]
          }
        },
        presences: {
          $sum: {
            $cond: [{ $eq: ['$isPresent', true] }, 1, 0]
          }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalClasses: 0,
      absences: 0,
      presences: 0,
      attendanceRate: 0,
      absenceRate: 0,
      maxAbsencesAllowed: 0,
      remainingAbsences: 0,
      isAtRisk: false
    };
  }

  const { totalClasses, absences, presences } = stats[0];
  const maxAbsencesAllowed = Math.floor(totalClasses * 0.25); // 25% do total
  const remainingAbsences = Math.max(0, maxAbsencesAllowed - absences);
  const attendanceRate = totalClasses > 0 ? (presences / totalClasses) * 100 : 0;
  const absenceRate = totalClasses > 0 ? (absences / totalClasses) * 100 : 0;
  const isAtRisk = absences > maxAbsencesAllowed;

  return {
    totalClasses,
    absences,
    presences,
    attendanceRate: Math.round(attendanceRate * 100) / 100,
    absenceRate: Math.round(absenceRate * 100) / 100,
    maxAbsencesAllowed,
    remainingAbsences,
    isAtRisk
  };
};

// Método para obter todas as estatísticas de um usuário
attendanceSchema.statics.getAllUserStats = async function(userId) {
  const subjects = await this.distinct('subjectId', { userId: mongoose.Types.ObjectId(userId) });
  
  const statsPromises = subjects.map(async (subjectId) => {
    const stats = await this.getAttendanceStats(userId, subjectId);
    const subject = await mongoose.model('Subject').findById(subjectId);
    
    return {
      subjectId,
      subjectName: subject?.name || 'Matéria não encontrada',
      subjectColor: subject?.color,
      ...stats
    };
  });

  return await Promise.all(statsPromises);
};

module.exports = mongoose.model('Attendance', attendanceSchema);