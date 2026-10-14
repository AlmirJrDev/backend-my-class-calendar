import { describe, it, expect } from 'vitest';
import { origensPermitidas, verificarOrigem, normalizarOrigem } from '../cors';

const decide = (env, origin) => {
  let resposta;
  verificarOrigem(env)(origin, (erro, permitido) => {
    expect(erro).toBeNull();
    resposta = permitido;
  });
  return resposta;
};

describe('normalizarOrigem', () => {
  it('tira a barra final, o caminho e a caixa alta', () => {
    expect(normalizarOrigem('HTTPS://Www.Site.com.br/')).toBe('https://www.site.com.br');
    expect(normalizarOrigem('https://site.com.br/dashboard?x=1')).toBe('https://site.com.br');
  });

  it('mantém a porta', () => {
    expect(normalizarOrigem('http://localhost:3000/')).toBe('http://localhost:3000');
  });

  it('recusa o que não é origem http(s)', () => {
    expect(normalizarOrigem('')).toBeNull();
    expect(normalizarOrigem(undefined)).toBeNull();
    expect(normalizarOrigem('não é url')).toBeNull();
    expect(normalizarOrigem('javascript:alert(1)')).toBeNull();
    expect(normalizarOrigem('null')).toBeNull();
  });
});

describe('origensPermitidas', () => {
  it('aceita o domínio com e sem www a partir de um só FRONTEND_URL', () => {
    const origens = origensPermitidas({ FRONTEND_URL: 'https://www.myclasscalendar.com.br' });
    expect(origens.has('https://www.myclasscalendar.com.br')).toBe(true);
    expect(origens.has('https://myclasscalendar.com.br')).toBe(true);
  });

  it('funciona igual quando o FRONTEND_URL é o apex e com barra no fim', () => {
    const origens = origensPermitidas({ FRONTEND_URL: 'https://myclasscalendar.com.br/' });
    expect(origens.has('https://www.myclasscalendar.com.br')).toBe(true);
    expect(origens.has('https://myclasscalendar.com.br')).toBe(true);
  });

  it('não confunde http com https', () => {
    const origens = origensPermitidas({ FRONTEND_URL: 'https://myclasscalendar.com.br' });
    expect(origens.has('http://myclasscalendar.com.br')).toBe(false);
  });

  it('inclui as origens extras, ignorando as inválidas e os espaços', () => {
    const origens = origensPermitidas({
      FRONTEND_URL: 'https://myclasscalendar.com.br',
      CORS_ORIGINS: ' https://front-antigo.vercel.app/ , lixo ,, https://outro.com ',
    });
    expect(origens.has('https://front-antigo.vercel.app')).toBe(true);
    expect(origens.has('https://outro.com')).toBe(true);
    expect([...origens].some((o) => o.includes('lixo'))).toBe(false);
  });

  it('o endereço extra não ganha a variante www sozinho', () => {
    const origens = origensPermitidas({ CORS_ORIGINS: 'https://front-antigo.vercel.app' });
    expect(origens.has('https://www.front-antigo.vercel.app')).toBe(false);
  });

  it('sempre libera o ambiente de desenvolvimento local', () => {
    const origens = origensPermitidas({});
    expect(origens.has('http://localhost:8080')).toBe(true);
    expect(origens.has('http://localhost:5173')).toBe(true);
  });

  it('localhost como FRONTEND_URL não ganha variante www', () => {
    const origens = origensPermitidas({ FRONTEND_URL: 'http://localhost:3000' });
    expect(origens.has('http://localhost:3000')).toBe(true);
    expect(origens.has('http://www.localhost:3000')).toBe(false);
  });
});

describe('verificarOrigem', () => {
  const env = { FRONTEND_URL: 'https://www.myclasscalendar.com.br' };

  it('libera o site, com ou sem www', () => {
    expect(decide(env, 'https://www.myclasscalendar.com.br')).toBe(true);
    expect(decide(env, 'https://myclasscalendar.com.br')).toBe(true);
  });

  it('libera chamada sem Origin (server-to-server)', () => {
    expect(decide(env, undefined)).toBe(true);
  });

  it('barra origem desconhecida sem lançar erro', () => {
    expect(decide(env, 'https://site-malicioso.com')).toBe(false);
  });

  it('barra domínio que só parece o nosso', () => {
    expect(decide(env, 'https://myclasscalendar.com.br.atacante.com')).toBe(false);
    expect(decide(env, 'https://xmyclasscalendar.com.br')).toBe(false);
  });

  it('barra tudo que não for desenvolvimento se nada foi configurado', () => {
    expect(decide({}, 'https://myclasscalendar.com.br')).toBe(false);
  });
});
