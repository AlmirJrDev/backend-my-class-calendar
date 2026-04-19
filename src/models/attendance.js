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
autoFilled: {
  type: Boolean,
  default: false,
  index: true
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
    return null;
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

// models/attendance.js — substituir o método getAllUserStats existente e adicionar autoFillPastPresences

attendanceSchema.statics.autoFillPastPresences = async function(userId, subject) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const semesterEnd = new Date(subject.semesterEndDate);
  semesterEnd.setHours(23, 59, 59, 999);

  // Limite: até ontem (dias que já passaram por completo)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  // Não pode ir além do fim do semestre
  const limitDate = semesterEnd < yesterday ? semesterEnd : yesterday;

  const start = new Date(subject.semesterStartDate);
  start.setHours(0, 0, 0, 0);

  if (start > limitDate) return; // Semestre ainda não começou

  // Montar mapa: dayOfWeek -> periods[]
  const scheduleMap = {};
  for (const slot of subject.schedule) {
    scheduleMap[slot.dayOfWeek] = slot.periods;
  }

  // Buscar todos os registros existentes de uma vez (evitar N+1)
  const existing = await this.find({
    userId: new mongoose.Types.ObjectId(userId),
    subjectId: subject._id,
    date: { $gte: start, $lte: limitDate }
  }).select('date period').lean();

  // Criar Set para lookup rápido: "YYYY-MM-DD_period"
  const existingSet = new Set(
    existing.map(r => {
      const d = new Date(r.date);
      return `${d.toISOString().slice(0, 10)}_${r.period}`;
    })
  );

  const toInsert = [];
  const cursor = new Date(start);

  while (cursor <= limitDate) {
    const dow = cursor.getDay();
    const periods = scheduleMap[dow];

    if (periods) {
      const dateStr = cursor.toISOString().slice(0, 10);

      for (const period of periods) {
        const key = `${dateStr}_${period}`;
        if (!existingSet.has(key)) {
          toInsert.push({
            userId: new mongoose.Types.ObjectId(userId),
            subjectId: subject._id,
            date: new Date(cursor),
            period,
            isPresent: true,
            autoFilled: true
          });
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  if (toInsert.length > 0) {
    // ordered: false para não parar em duplicate key (race condition)
    await this.insertMany(toInsert, { ordered: false }).catch(err => {
      // Ignorar duplicate key errors silenciosamente
      if (err.code !== 11000) throw err;
    });
  }
};

// Substituir getAllUserStats — agora busca TODAS as matérias do usuário
attendanceSchema.statics.getAllUserStats = async function(userId) {
  const Subject = mongoose.model('Subject');

  // Busca todas as matérias do usuário (não só as que têm registro)
  const subjects = await Subject.find({
    userId: new mongoose.Types.ObjectId(userId),
    active: true
  });

  const statsPromises = subjects.map(async (subject) => {
    // Auto-fill presences antes de calcular
    await this.autoFillPastPresences(userId, subject);

    const stats = await this.getAttendanceStats(userId, subject._id);
    if (!stats) return null;

    return {
      subjectId: subject._id,
      subjectName: subject.name,
      subjectColor: subject.color,
      ...stats
    };
  });

  const results = await Promise.all(statsPromises);
  return results.filter(Boolean);
};

module.exports = mongoose.model('Attendance', attendanceSchema);