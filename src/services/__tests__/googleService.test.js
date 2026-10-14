import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { dadosDoGoogle, GOOGLE_CLIENT_ID } = require('../googleService');

describe('dadosDoGoogle', () => {
  it('aproveita e-mail e nome de um e-mail confirmado', () => {
    expect(dadosDoGoogle({ email: ' Ana@Gmail.com ', email_verified: true, name: 'Ana Souza' })).toEqual({
      email: 'ana@gmail.com',
      name: 'Ana Souza',
    });
  });

  it('recusa e-mail não confirmado pelo Google', () => {
    // Sem isto, alguém criaria uma conta Google com o e-mail de outra pessoa e
    // entraria na conta dela aqui.
    expect(dadosDoGoogle({ email: 'ana@exemplo.com', email_verified: false, name: 'Ana' }).erro).toMatch(/confirmado/);
    expect(dadosDoGoogle({ email: 'ana@exemplo.com', name: 'Ana' }).erro).toMatch(/confirmado/);
    expect(dadosDoGoogle({ email: 'ana@exemplo.com', email_verified: 'true', name: 'Ana' }).erro).toMatch(/confirmado/);
  });

  it('recusa sem e-mail', () => {
    expect(dadosDoGoogle({ email_verified: true }).erro).toMatch(/e-mail/);
    expect(dadosDoGoogle(undefined).erro).toMatch(/e-mail/);
  });

  it('sem nome, usa o começo do e-mail', () => {
    expect(dadosDoGoogle({ email: 'joao.silva@gmail.com', email_verified: true }).name).toBe('joao.silva');
  });

  it('o ID do cliente padrão é o do projeto do Google', () => {
    expect(GOOGLE_CLIENT_ID).toMatch(/\.apps\.googleusercontent\.com$/);
  });
});
