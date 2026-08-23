import { describe, it, expect } from 'vitest';
import otpService from '../otpService.js';

const { evaluateOtpAttempt, generateOtp, hashOtp, MAX_OTP_ATTEMPTS } = otpService;

const account = (overrides = {}) => ({
  verificationOtp: hashOtp('123456'),
  verificationTokenExpire: new Date(Date.now() + 10 * 60 * 1000),
  otpAttempts: 0,
  ...overrides
});

describe('evaluateOtpAttempt', () => {
  it('aceita o código correto', () => {
    expect(evaluateOtpAttempt(account(), '123456').outcome).toBe('ok');
  });

  it('recusa o código errado', () => {
    expect(evaluateOtpAttempt(account(), '999999').outcome).toBe('mismatch');
  });

  it('aceita o código como número', () => {
    expect(evaluateOtpAttempt(account(), 123456).outcome).toBe('ok');
  });

  describe('código pendente', () => {
    it('recusa quando não há conta', () => {
      expect(evaluateOtpAttempt(null, '123456').outcome).toBe('no_pending_otp');
    });

    it('recusa quando não há código vigente', () => {
      const a = account({ verificationOtp: undefined });
      expect(evaluateOtpAttempt(a, '123456').outcome).toBe('no_pending_otp');
    });

    it('recusa quando não há data de expiração', () => {
      const a = account({ verificationTokenExpire: undefined });
      expect(evaluateOtpAttempt(a, '123456').outcome).toBe('no_pending_otp');
    });

    it('recusa código expirado mesmo estando correto', () => {
      const a = account({ verificationTokenExpire: new Date(Date.now() - 1) });
      expect(evaluateOtpAttempt(a, '123456').outcome).toBe('no_pending_otp');
    });

    it('trata o instante exato da expiração como expirado', () => {
      const now = Date.now();
      const a = account({ verificationTokenExpire: new Date(now) });
      expect(evaluateOtpAttempt(a, '123456', now).outcome).toBe('no_pending_otp');
    });

    it('aceita um milissegundo antes de expirar', () => {
      const now = Date.now();
      const a = account({ verificationTokenExpire: new Date(now + 1) });
      expect(evaluateOtpAttempt(a, '123456', now).outcome).toBe('ok');
    });
  });

  describe('trava de força bruta', () => {
    it('permite tentativas abaixo do limite', () => {
      const a = account({ otpAttempts: MAX_OTP_ATTEMPTS - 1 });
      expect(evaluateOtpAttempt(a, '999999').outcome).toBe('mismatch');
    });

    it('trava ao atingir o limite', () => {
      const a = account({ otpAttempts: MAX_OTP_ATTEMPTS });
      expect(evaluateOtpAttempt(a, '999999').outcome).toBe('locked');
    });

    it('trava mesmo quando o código está correto', () => {
      const a = account({ otpAttempts: MAX_OTP_ATTEMPTS });
      expect(evaluateOtpAttempt(a, '123456').outcome).toBe('locked');
    });

    it('trava acima do limite', () => {
      const a = account({ otpAttempts: MAX_OTP_ATTEMPTS + 50 });
      expect(evaluateOtpAttempt(a, '123456').outcome).toBe('locked');
    });

    it('trata contador ausente como zero', () => {
      const a = account({ otpAttempts: undefined });
      expect(evaluateOtpAttempt(a, '123456').outcome).toBe('ok');
    });

    it('confere a expiração antes da trava', () => {
      // Código expirado numa conta travada não deve virar 'locked': o usuário
      // precisa é pedir um código novo.
      const a = account({
        otpAttempts: MAX_OTP_ATTEMPTS,
        verificationTokenExpire: new Date(Date.now() - 1)
      });
      expect(evaluateOtpAttempt(a, '123456').outcome).toBe('no_pending_otp');
    });
  });

  describe('entradas malformadas', () => {
    it('não estoura com código undefined', () => {
      expect(evaluateOtpAttempt(account(), undefined).outcome).toBe('mismatch');
    });

    it('não estoura com hash armazenado de tamanho diferente', () => {
      const a = account({ verificationOtp: 'abcd' });
      expect(evaluateOtpAttempt(a, '123456').outcome).toBe('mismatch');
    });

    it('não estoura com hash armazenado não-hexadecimal', () => {
      const a = account({ verificationOtp: 'nao-e-hex' });
      expect(() => evaluateOtpAttempt(a, '123456')).not.toThrow();
    });
  });
});

describe('generateOtp', () => {
  it('gera sempre 6 dígitos', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it('nunca gera valor com zero à esquerda', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateOtp().startsWith('0')).toBe(false);
    }
  });

  it('não repete o mesmo código seguidamente', () => {
    const gerados = new Set(Array.from({ length: 200 }, generateOtp));
    expect(gerados.size).toBeGreaterThan(150);
  });
});

describe('hashOtp', () => {
  it('é determinístico', () => {
    expect(hashOtp('123456')).toBe(hashOtp('123456'));
  });

  it('não guarda o código em claro', () => {
    expect(hashOtp('123456')).not.toContain('123456');
    expect(hashOtp('123456')).toHaveLength(64);
  });

  it('trata número e string igualmente', () => {
    expect(hashOtp(123456)).toBe(hashOtp('123456'));
  });
});
