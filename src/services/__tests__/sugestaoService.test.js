import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  turmasQueModera,
  podeModerar,
  podeVer,
  turmaDaNovaSugestao,
  camposDoEventoDaSugestao
} = require('../sugestaoService');

const TURMA_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TURMA_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

// `escopo` é o que o middleware de turma deixa em req.turmaIds.
const req = (papeis, { escopo, role = 'user', id = 'u1' } = {}) => ({
  user: { id, role },
  papelNaTurma: new Map(Object.entries(papeis)),
  turmaIds: escopo ?? Object.keys(papeis)
});

const sugestao = (partes = {}) => ({ turmaId: TURMA_A, userId: 'autor', ...partes });

describe('turmasQueModera', () => {
  it('só as turmas em que a pessoa é representante', () => {
    const r = req({ [TURMA_A]: 'aluno', [TURMA_B]: 'representante' });
    expect(turmasQueModera(r)).toEqual([TURMA_B]);
  });

  it('aluno não modera turma nenhuma', () => {
    expect(turmasQueModera(req({ [TURMA_A]: 'aluno' }))).toEqual([]);
  });

  it('respeita a turma ativa escolhida no escopo', () => {
    const r = req({ [TURMA_A]: 'representante', [TURMA_B]: 'representante' }, { escopo: [TURMA_B] });
    expect(turmasQueModera(r)).toEqual([TURMA_B]);
  });

  it('superadmin modera só as turmas em que participa, sem visão global', () => {
    const r = req({ [TURMA_A]: 'aluno' }, { role: 'superadmin' });
    expect(turmasQueModera(r)).toEqual([TURMA_A]);
  });
});

describe('podeModerar — o vazamento entre turmas', () => {
  it('representante da turma da sugestão modera', () => {
    expect(podeModerar(req({ [TURMA_A]: 'representante' }), sugestao())).toBe(true);
  });

  it('representante de OUTRA turma não modera', () => {
    // Era o bug: qualquer representante via e aprovava sugestão de qualquer turma.
    expect(podeModerar(req({ [TURMA_B]: 'representante' }), sugestao())).toBe(false);
  });

  it('aluno da turma não modera', () => {
    expect(podeModerar(req({ [TURMA_A]: 'aluno' }), sugestao())).toBe(false);
  });

  it('sugestão sem turma não é moderável por ninguém', () => {
    expect(podeModerar(req({ [TURMA_A]: 'representante' }), sugestao({ turmaId: undefined }))).toBe(false);
  });
});

describe('podeVer', () => {
  it('o autor vê a própria, com o autor já populado ou só o id', () => {
    expect(podeVer(req({ [TURMA_B]: 'aluno' }, { id: 'autor' }), sugestao())).toBe(true);
    expect(podeVer(req({ [TURMA_B]: 'aluno' }, { id: 'autor' }), sugestao({ userId: { _id: 'autor' } }))).toBe(true);
  });

  it('outro aluno não vê', () => {
    expect(podeVer(req({ [TURMA_A]: 'aluno' }), sugestao())).toBe(false);
  });

  it('representante da turma vê; o de outra turma não', () => {
    expect(podeVer(req({ [TURMA_A]: 'representante' }), sugestao())).toBe(true);
    expect(podeVer(req({ [TURMA_B]: 'representante' }), sugestao())).toBe(false);
  });
});

describe('turmaDaNovaSugestao', () => {
  it('aluno com uma turma no escopo: a sugestão nasce nela', () => {
    expect(turmaDaNovaSugestao(req({ [TURMA_A]: 'aluno' }))).toEqual({ turmaId: TURMA_A });
  });

  it('sem turma, recusa', () => {
    expect(turmaDaNovaSugestao(req({}, { escopo: [] })).erro).toMatch(/participar de uma turma/);
  });

  it('com várias turmas no escopo, pede para escolher em vez de adivinhar', () => {
    const r = req({ [TURMA_A]: 'aluno', [TURMA_B]: 'aluno' });
    expect(turmaDaNovaSugestao(r).erro).toMatch(/Escolha a turma/);
  });

  it('representante é orientado a criar o evento direto', () => {
    expect(turmaDaNovaSugestao(req({ [TURMA_A]: 'representante' })).erro).toMatch(/direto no calendário/);
  });

  it('representante de outra turma, aluno nesta, pode sugerir nesta', () => {
    const r = req({ [TURMA_A]: 'aluno', [TURMA_B]: 'representante' }, { escopo: [TURMA_A] });
    expect(turmaDaNovaSugestao(r)).toEqual({ turmaId: TURMA_A });
  });
});

describe('camposDoEventoDaSugestao', () => {
  it('traduz o tipo para o enum do evento', () => {
    // "atividade" não é valor do model Event: a aprovação falhava na validação.
    expect(camposDoEventoDaSugestao({ type: 'atividade' }).type).toBe('ativity');
    expect(camposDoEventoDaSugestao({ type: 'prova' }).type).toBe('exam');
    expect(camposDoEventoDaSugestao({ type: 'trabalho' }).type).toBe('assignment');
    expect(camposDoEventoDaSugestao({ type: 'aula' }).type).toBe('class');
    expect(camposDoEventoDaSugestao({ type: 'outro' }).type).toBe('ativity');
  });

  it('mantém um tipo que já é do evento', () => {
    expect(camposDoEventoDaSugestao({ type: 'exam' }).type).toBe('exam');
  });

  it('descarta o que o evento não tem ou não deve receber', () => {
    const campos = camposDoEventoDaSugestao({
      title: 'Lista 04',
      priority: 'media',
      completed: true,
      turmaId: TURMA_B,
      userId: 'outra-pessoa'
    });
    expect(campos).toEqual({ title: 'Lista 04' });
  });

  it('não inventa campos ausentes, para atualização parcial não apagar nada', () => {
    expect(camposDoEventoDaSugestao({ title: 'Novo' })).toEqual({ title: 'Novo' });
    expect(camposDoEventoDaSugestao(undefined)).toEqual({});
    expect(camposDoEventoDaSugestao({ time: null, location: null })).toEqual({});
  });
});
