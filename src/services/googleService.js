/**
 * Entrar com Google: o front recebe do Google um token assinado (ID token) e
 * manda para cá. Aqui o token é conferido com o Google e vira uma sessão nossa.
 */
const { OAuth2Client } = require('google-auth-library');

// O ID do cliente é público (vai no próprio site); a variável de ambiente só
// existe para trocar de projeto do Google sem mexer no código.
exports.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || '86048974608-3bkvif5o66r3ekunfergjgi47imsnai3.apps.googleusercontent.com';

let cliente;

/**
 * Confere assinatura, validade e destinatário do token (precisa ter sido
 * emitido para o nosso app, não para outro site). Lança erro se não confere.
 */
exports.verificarCredencial = async (credential) => {
  cliente ??= new OAuth2Client(exports.GOOGLE_CLIENT_ID);
  const ticket = await cliente.verifyIdToken({ idToken: credential, audience: exports.GOOGLE_CLIENT_ID });
  return ticket.getPayload();
};

/**
 * O que aproveitamos do Google: e-mail e nome. Só vale e-mail confirmado pelo
 * Google; é isso que permite ligar o login à conta de quem já entrava por
 * código com o mesmo e-mail sem abrir uma porta para tomar a conta de alguém.
 */
exports.dadosDoGoogle = (payload) => {
  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email) return { erro: 'O Google não informou o e-mail da conta' };
  if (payload.email_verified !== true) return { erro: 'Este e-mail ainda não foi confirmado no Google' };

  const nome = typeof payload.name === 'string' ? payload.name.trim() : '';
  return { email, name: (nome || email.split('@')[0]).slice(0, 100) };
};
