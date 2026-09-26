import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { camposDoEvento, gerenciaTurma } = require('../eventoService');

const TURMA_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TURMA_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const req = (papeis, role = 'user') => ({
  user: { id: 'u1', role },
  papelNaTurma: new Map(Object.entries(papeis))
});

describe('camposDoEvento', () => {
  it('descarta turmaId, userId e completed vindos do corpo', () => {
    const dados = camposDoEvento({
      title: 'P1',
      type: 'exam',
      location: 'Lab 2',
      endTime: '12:30',
      turmaId: TURMA_B,
      userId: 'outra-pessoa',
      completed: true
    });
    expect(dados).toEqual({ title: 'P1', type: 'exam', location: 'Lab 2', endTime: '12:30' });
  });

  it('não inventa campos ausentes, para a edição parcial não apagar nada', () => {
    expect(camposDoEvento({ title: 'Novo' })).toEqual({ title: 'Novo' });
  });
});

describe('camposDoEvento — ligação com a nota', () => {
  it('aceita a matéria pelo id e o item da fórmula', () => {
    expect(camposDoEvento({ subjectId: 'abc', gradeKey: 'P1' })).toEqual({ subjectId: 'abc', gradeKey: 'P1' });
  });
});

describe('gerenciaTurma', () => {
  it('representante da turma gerencia', () => {
    expect(gerenciaTurma(req({ [TURMA_A]: 'representante' }), TURMA_A)).toBe(true);
  });

  it('aluno da turma não gerencia', () => {
    expect(gerenciaTurma(req({ [TURMA_A]: 'aluno' }), TURMA_A)).toBe(false);
  });

  it('ser representante de outra turma não basta', () => {
    const r = req({ [TURMA_A]: 'aluno', [TURMA_B]: 'representante' });
    expect(gerenciaTurma(r, TURMA_A)).toBe(false);
  });

  it('superadmin passa para dar suporte', () => {
    expect(gerenciaTurma(req({}, 'superadmin'), TURMA_A)).toBe(true);
  });
});

describe('podeApagarNota', () => {
  const { podeApagarNota } = require('../eventoService');
  const nota = { userId: 'autor', turmaId: TURMA_A };

  it('quem escreveu apaga a própria', () => {
    const r = { user: { id: 'autor', role: 'user' }, papelNaTurma: new Map([[TURMA_A, 'aluno']]) };
    expect(podeApagarNota(r, nota)).toBe(true);
  });

  it('funciona com o autor já populado', () => {
    const r = { user: { id: 'autor', role: 'user' }, papelNaTurma: new Map([[TURMA_A, 'aluno']]) };
    expect(podeApagarNota(r, { ...nota, userId: { _id: 'autor', name: 'Ana' } })).toBe(true);
  });

  it('colega aluno não apaga a de outra pessoa', () => {
    const r = { user: { id: 'colega', role: 'user' }, papelNaTurma: new Map([[TURMA_A, 'aluno']]) };
    expect(podeApagarNota(r, nota)).toBe(false);
  });

  it('representante da turma apaga qualquer uma', () => {
    const r = { user: { id: 'rep', role: 'user' }, papelNaTurma: new Map([[TURMA_A, 'representante']]) };
    expect(podeApagarNota(r, nota)).toBe(true);
  });
});
