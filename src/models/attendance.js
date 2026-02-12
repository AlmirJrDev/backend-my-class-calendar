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
    default: false
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Índices compostos
attendanceSchema.index({ userId: 1, subjectId: 1 });
attendanceSchema.index({ userId: 1, subjectId: 1, date: 1, period: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

// Middleware para validar data dentro do semestre
attendanceSchema.pre('save', async function(next) {
  try {
    const Subject = mongoose.model('Subject');
    const subject = await Subject.findById(this.subjectId);
    
    if (!subject) {
      return next(new Error('Matéria não encontrada'));
    }
    
    const attendanceDate = new Date(this.date);
    const startDate = new Date(subject.semesterStartDate);
    const endDate = new Date(subject.semesterEndDate);
    
    if (attendanceDate < startDate || attendanceDate > endDate) {
      return next(new Error('A data do registro deve estar dentro do período do semestre'));
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Método estático para calcular estatísticas de presença (ATUALIZADO)
attendanceSchema.statics.getAttendanceStats = async function(userId, subjectId) {
  const Subject = mongoose.model('Subject');
  const subject = await Subject.findById(subjectId);
  
  if (!subject) {
    throw new Error('Matéria não encontrada');
  }

  const stats = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        subjectId: new mongoose.Types.ObjectId(subjectId)
      }
    },
    {
      $group: {
        _id: null,
        totalRegistered: { $sum: 1 },
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

  const totalClasses = subject.totalClasses;
  const totalRegistered = stats.length > 0 ? stats[0].totalRegistered : 0;
  const absences = stats.length > 0 ? stats[0].absences : 0;
  const presences = stats.length > 0 ? stats[0].presences : 0;
  
  const maxAbsencesAllowed = Math.floor(totalClasses * 0.25); // 25% do total
  const remainingAbsences = Math.max(0, maxAbsencesAllowed - absences);
  
  // Calcular taxas baseadas no total de aulas da matéria
  const attendanceRate = totalClasses > 0 ? (presences / totalClasses) * 100 : 0;
  const absenceRate = totalClasses > 0 ? (absences / totalClasses) * 100 : 0;
  const registeredRate = totalClasses > 0 ? (totalRegistered / totalClasses) * 100 : 0;
  
  const isAtRisk = absences > maxAbsencesAllowed;
  const classesRemaining = Math.max(0, totalClasses - totalRegistered);

  return {
    totalClasses,
    totalRegistered,
    classesRemaining,
    absences,
    presences,
    attendanceRate: Math.round(attendanceRate * 100) / 100,
    absenceRate: Math.round(absenceRate * 100) / 100,
    registeredRate: Math.round(registeredRate * 100) / 100,
    maxAbsencesAllowed,
    remainingAbsences,
    isAtRisk,
    semesterStartDate: subject.semesterStartDate,
    semesterEndDate: subject.semesterEndDate,
    isSemesterActive: subject.isSemesterActive()
  };
};

// Método para obter todas as estatísticas de um usuário
attendanceSchema.statics.getAllUserStats = async function(userId) {
  const subjects = await this.distinct('subjectId', { userId: new mongoose.Types.ObjectId(userId) });
  
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