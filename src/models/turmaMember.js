const mongoose = require('mongoose');

/**
 * Vínculo entre pessoa e turma. É tabela própria, e não um campo no usuário,
 * porque a mesma pessoa participa de várias turmas — dependência, optativa,
 * turma de outro curso — e pode ser representante numa e aluno em outra.
 */
const turmaMemberSchema = new mongoose.Schema(
  {
    turmaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Turma',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Papel dentro desta turma. É separado de User.role, que diz apenas se a
    // pessoa administra a plataforma inteira.
    role: {
      type: String,
      enum: ['representante', 'aluno'],
      default: 'aluno'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Uma pessoa entra uma vez só em cada turma.
turmaMemberSchema.index({ turmaId: 1, userId: 1 }, { unique: true });

/** Ids das turmas de que a pessoa participa. */
turmaMemberSchema.statics.turmaIdsDoUsuario = async function (userId) {
  const vinculos = await this.find({ userId }).select('turmaId').lean();
  return vinculos.map((v) => v.turmaId);
};

/** Diz se a pessoa participa da turma, e com qual papel. */
turmaMemberSchema.statics.vinculo = function (turmaId, userId) {
  return this.findOne({ turmaId, userId });
};

module.exports = mongoose.model('TurmaMember', turmaMemberSchema);
