const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * A turma é a fronteira de dados do app: matérias e eventos pertencem a uma
 * turma, e só quem é membro dela enxerga esse conteúdo.
 */
const turmaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'O nome da turma é obrigatório'],
      trim: true
    },
    // Semestre letivo no formato "2026/2".
    semester: {
      type: String,
      trim: true,
      match: [/^\d{4}\/[12]$/, 'O semestre deve estar no formato AAAA/S']
    },
    // Quem criou a turma. É o representante inicial, e o vínculo dele fica
    // registrado em TurmaMember como qualquer outro.
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A turma precisa de um dono']
    },
    // Segredo do link de convite. Fica fora das respostas por padrão: quem
    // precisa dele é o representante, numa rota própria.
    inviteCode: {
      type: String,
      unique: true,
      index: true,
      select: false,
      default: () => crypto.randomBytes(9).toString('base64url')
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

turmaSchema.index({ ownerId: 1, active: 1 });

/** Gera um convite novo, invalidando o link anterior. */
turmaSchema.methods.rotateInviteCode = function () {
  this.inviteCode = crypto.randomBytes(9).toString('base64url');
  return this.inviteCode;
};

module.exports = mongoose.model('Turma', turmaSchema);
