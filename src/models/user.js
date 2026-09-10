const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Por favor, forneça um email válido'
    ]
  },
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true
  },
  // Papel global: superadmin acompanha todas as turmas. Quem representa uma
  // turma e definido em TurmaMember.role, e nao aqui.
  role: {
    type: String,
    enum: ['superadmin', 'user'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationOtp: String,        // hash do OTP de 6 dígitos
  verificationTokenExpire: Date,  // compartilhado entre OTP e magic link
  otpAttempts: {                  // tentativas erradas do OTP vigente
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);