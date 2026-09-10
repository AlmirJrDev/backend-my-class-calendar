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
    // Link de leitura do calendário. É PROPOSITALMENTE separado do
    // inviteCode: quem recebe o link de olhar não pode virar membro. Nulo
    // enquanto o representante não liga o compartilhamento.
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      select: false,
      default: null
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

/**
 * Liga ou renova o link de leitura. O token é mais longo que o do convite
 * porque fica exposto em qualquer lugar onde o link for colado.
 */
turmaSchema.methods.rotateShareToken = function () {
  this.shareToken = crypto.randomBytes(16).toString('base64url');
  return this.shareToken;
};

/** Desliga o compartilhamento; o link existente para de funcionar. */
turmaSchema.methods.disableSharing = function () {
  this.shareToken = null;
};

module.exports = mongoose.model('Turma', turmaSchema);
