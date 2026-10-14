import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  VERSAO_DOS_TERMOS,
  termosPendentes,
  registroDeAceite,
  confereEmail,
  exportarDados,
  excluirConta,
  turmasQueImpedem,
  DA_PESSOA
} = require('../contaService');

const EU = 'u1';

function modelsFalsos() {
  const chamadas = [];
  const consulta = (nome, valor) => ({
    select(campos) {
      chamadas.push([nome, 'select', campos]);
      return this;
    },
    lean: async () => valor
  });
  const model = (nome) => ({
    find: (filtro) => {
      chamadas.push([nome, 'find', filtro]);
      return consulta(nome, [{ de: nome }]);
    },
    findById: (id) => {
      chamadas.push([nome, 'findById', id]);
      return consulta(nome, { _id: id, name: 'Ana' });
    },
    deleteMany: async (filtro) => {
      chamadas.push([nome, 'deleteMany', filtro]);
      return { deletedCount: 2 };
    },
    deleteOne: async (filtro) => {
      chamadas.push([nome, 'deleteOne', filtro]);
      return { deletedCount: 1 };
    }
  });
  const nomes = ['User', 'Turma', ...DA_PESSOA.map(([, m]) => m)];
  return { models: Object.fromEntries(nomes.map((n) => [n, model(n)])), chamadas };
}

describe('termos', () => {
  it('pendente para quem nunca aceitou ou aceitou uma versão antiga', () => {
    expect(termosPendentes({})).toBe(true);
    expect(termosPendentes({ termosAceitos: { versao: '2020-01-01' } })).toBe(true);
    expect(termosPendentes(null)).toBe(true);
  });

  it('em dia para quem aceitou a versão atual', () => {
    expect(termosPendentes({ termosAceitos: registroDeAceite() })).toBe(false);
  });

  it('o registro guarda a versão e o momento', () => {
    const agora = new Date('2026-10-14T20:00:00Z');
    expect(registroDeAceite(agora)).toEqual({ versao: VERSAO_DOS_TERMOS, em: agora });
  });
});

describe('confereEmail', () => {
  it('aceita o e-mail da conta, sem diferença de caixa ou espaço', () => {
    expect(confereEmail('  Ana@Exemplo.com ', 'ana@exemplo.com')).toBe(true);
  });

  it('recusa outro e-mail ou vazio', () => {
    expect(confereEmail('outra@exemplo.com', 'ana@exemplo.com')).toBe(false);
    expect(confereEmail('', 'ana@exemplo.com')).toBe(false);
    expect(confereEmail('ana@exemplo.com', '')).toBe(false);
  });
});

describe('exportarDados', () => {
  it('traz o perfil sem os segredos de login e cada parte filtrada pela pessoa', async () => {
    const { models, chamadas } = modelsFalsos();
    const dados = await exportarDados(EU, models, new Date('2026-10-14T20:00:00Z'));

    const selectDoPerfil = chamadas.find(([n, op]) => n === 'User' && op === 'select')[2];
    for (const segredo of ['verificationToken', 'verificationOtp', 'calendarToken', 'otpAttempts']) {
      expect(selectDoPerfil).toContain(`-${segredo}`);
    }
    for (const [, model] of DA_PESSOA) {
      expect(chamadas).toContainEqual([model, 'find', { userId: EU }]);
    }
    expect(dados).toMatchObject({ geradoEm: '2026-10-14T20:00:00.000Z', perfil: { _id: EU } });
    expect(Object.keys(dados)).toEqual(expect.arrayContaining(DA_PESSOA.map(([parte]) => parte)));
  });

  it('não lê nem apaga nada de turma', async () => {
    const { models, chamadas } = modelsFalsos();
    await exportarDados(EU, models);
    expect(chamadas.some(([, op]) => op.startsWith('delete'))).toBe(false);
    expect(chamadas.some(([n]) => n === 'Turma')).toBe(false);
  });
});

describe('excluirConta', () => {
  it('apaga só o que é da pessoa, e o usuário por último', async () => {
    const { models, chamadas } = modelsFalsos();
    const apagados = await excluirConta(EU, models);

    const apagou = chamadas.filter(([, op]) => op.startsWith('delete'));
    expect(apagou.map(([n]) => n)).toEqual([...DA_PESSOA.map(([, m]) => m), 'User']);
    for (const [nome, op, filtro] of apagou) {
      expect(filtro, nome).toEqual(op === 'deleteOne' ? { _id: EU } : { userId: EU });
    }
    expect(apagados.presencas).toBe(2);
  });

  it('não toca em turma, matéria nem evento', async () => {
    const { models, chamadas } = modelsFalsos();
    await excluirConta(EU, models);
    expect(chamadas.some(([n]) => ['Turma', 'Subject', 'Event'].includes(n))).toBe(false);
  });
});

describe('turmasQueImpedem', () => {
  it('procura as turmas em que a pessoa é dona', async () => {
    const { models, chamadas } = modelsFalsos();
    await turmasQueImpedem(EU, models);
    expect(chamadas).toContainEqual(['Turma', 'find', { ownerId: EU }]);
  });
});
