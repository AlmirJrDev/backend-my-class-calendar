const crypto = require('crypto');

// Tentativas erradas permitidas antes de exigir um novo código.
const MAX_OTP_ATTEMPTS = 5;

/**
 * Decide o desfecho de uma tentativa de OTP. Função pura: não toca no banco,
 * para que a regra de segurança seja testável isoladamente. Quem persiste o
 * contador é o controller.
 *
 * Devolve `{ outcome }`, onde outcome é:
 *   'no_pending_otp' — não há código vigente (ou expirou)
 *   'locked'         — tentativas esgotadas; precisa pedir outro código
 *   'mismatch'       — código errado (o controller incrementa o contador)
 *   'ok'             — código confere
 */
exports.evaluateOtpAttempt = (account, otp, now = Date.now()) => {
  const expiresAt = account?.verificationTokenExpire;

  if (!account || !account.verificationOtp || !expiresAt) {
    return { outcome: 'no_pending_otp' };
  }

  if (new Date(expiresAt).getTime() <= now) {
    return { outcome: 'no_pending_otp' };
  }

  // A trava vem antes da comparação: sem ela, o rate limit por IP (em memória,
  // e o Vercel roda várias instâncias) seria a única barreira contra força
  // bruta num código de apenas 6 dígitos.
  if ((account.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
    return { outcome: 'locked' };
  }

  return { outcome: matchesOtp(account.verificationOtp, otp) ? 'ok' : 'mismatch' };
};

/** Compara o hash do código informado em tempo constante. */
function matchesOtp(storedHash, otp) {
  const provided = crypto.createHash('sha256').update(String(otp)).digest('hex');

  const expectedBuf = Buffer.from(storedHash, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');

  return (
    expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf)
  );
}

exports.MAX_OTP_ATTEMPTS = MAX_OTP_ATTEMPTS;
exports.hashOtp = (otp) =>
  crypto.createHash('sha256').update(String(otp)).digest('hex');

/** Gera um código de 6 dígitos com gerador criptográfico. */
exports.generateOtp = () => crypto.randomInt(100000, 1000000).toString();
