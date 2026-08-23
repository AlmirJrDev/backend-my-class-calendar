const rateLimit = require('express-rate-limit');

// Resposta padronizada no mesmo formato dos demais erros da API.
const handler = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  });
};

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  handler
};

// Limite geral, aplicado a toda a API.
exports.apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 300
});

// Envio de OTP / magic link: evita usar a API como máquina de spam de email.
exports.requestAccessLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 5
});

// Conferência do OTP: primeira barreira contra força bruta no código de 6
// dígitos. Como o Vercel roda várias instâncias e este store é em memória, o
// limite definitivo é o contador `otpAttempts` gravado no próprio usuário.
exports.verifyOtpLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10
});
