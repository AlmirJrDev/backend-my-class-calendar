import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { podeExcluir, confereNome, contarDaTurma, excluirTurma, ORDEM } = require('../exclusaoDeTurmaService');

const TURMA = 'aaaaaaaaaaaaaaaaaaaaaaaa';

/** Models de mentira: registram cada chamada e devolvem números fixos. */
function modelsFalsos() {
  const chamadas = [];
  const model = (nome, ids = []) => ({
    find: (filtro) => ({
      distinct: async (campo) => {
        chamadas.push([nome, 'distinct', filtro, campo]);
        return ids;
      }
    }),
    countDocuments: async (filtro) => {
      chamadas.push([nome, 'count', filtro]);
      return 2;
    },
    deleteMany: async (filtro) => {
      chamadas.push([nome, 'deleteMany', filtro]);
      return { deletedCount: 3 };
    },
    deleteOne: async (filtro) => {
      chamadas.push([nome, 'deleteOne', filtro]);
      return { deletedCount: 1 };
    }
  });
  const models = {
    Subject: model('Subject', ['m1', 'm2']),
    Event: model('Event', ['e1']),
    Attendance: model('Attendance'),
    GradeEntry: model('GradeEntry'),
    EventNote: model('EventNote'),
    Material: model('Material'),
    Chamada: model('Chamada'),
    EventSuggestion: model('EventSuggestion'),
    TurmaMember: model('TurmaMember'),
    Turma: model('Turma')
  };
  return { models, chamadas };
}

describe('podeExcluir', () => {
  const turma = { ownerId: 'dono' };

  it('quem criou a turma pode', () => {
    expect(podeExcluir(turma, 'dono')).toBe(true);
  });

  it('outro representante ou aluno não pode', () => {
    expect(podeExcluir(turma, 'outra-pessoa')).toBe(false);
  });

  it('sem turma ou sem pessoa, não', () => {
    expect(podeExcluir(null, 'dono')).toBe(false);
    expect(podeExcluir(turma, undefined)).toBe(false);
  });

  it('compara ObjectId com texto', () => {
    expect(podeExcluir({ ownerId: { toString: () => 'dono' } }, 'dono')).toBe(true);
  });
});

describe('confereNome', () => {
  const nome = 'Sistemas de Informação — noturno';

  it('aceita o nome exato', () => {
    expect(confereNome(nome, nome)).toBe(true);
  });

  it('aceita hífen no lugar do travessão, outra caixa e espaços a mais', () => {
    expect(confereNome('  sistemas de informação - NOTURNO ', nome)).toBe(true);
    expect(confereNome('Sistemas  de Informação – noturno', nome)).toBe(true);
  });

  it('recusa nome diferente, parcial ou vazio', () => {
    expect(confereNome('Sistemas de Informação', nome)).toBe(false);
    expect(confereNome('Sistemas de Informacao - noturno', nome)).toBe(false);
    expect(confereNome('', nome)).toBe(false);
    expect(confereNome('', '')).toBe(false);
  });
});

describe('excluirTurma', () => {
  it('apaga na ordem certa: dependências antes, membros e turma por último', async () => {
    const { models, chamadas } = modelsFalsos();
    await excluirTurma(TURMA, models);

    const apagou = chamadas.filter(([, op]) => op === 'deleteMany' || op === 'deleteOne').map(([nome]) => nome);
    expect(apagou).toEqual([
      'Attendance',
      'GradeEntry',
      'EventNote',
      'Material',
      'Chamada',
      'EventSuggestion',
      'Event',
      'Subject',
      'TurmaMember',
      'Turma'
    ]);
  });

  it('presença e nota saem pelas matérias da turma, que não guardam a turma', async () => {
    const { models, chamadas } = modelsFalsos();
    await excluirTurma(TURMA, models);
    const filtro = (nome) => chamadas.find(([n, op]) => n === nome && op === 'deleteMany')[2];

    expect(filtro('Attendance')).toEqual({ subjectId: { $in: ['m1', 'm2'] } });
    expect(filtro('GradeEntry')).toEqual({ subjectId: { $in: ['m1', 'm2'] } });
  });

  it('observações e materiais antigos, sem turmaId, também saem pelo evento e pela matéria', async () => {
    const { models, chamadas } = modelsFalsos();
    await excluirTurma(TURMA, models);
    const filtro = (nome) => chamadas.find(([n, op]) => n === nome && op === 'deleteMany')[2];

    expect(filtro('EventNote')).toEqual({ $or: [{ turmaId: TURMA }, { eventId: { $in: ['e1'] } }] });
    expect(filtro('Material').$or).toContainEqual({ subjectId: { $in: ['m1', 'm2'] } });
    expect(filtro('Material').$or).toContainEqual({ eventId: { $in: ['e1'] } });
  });

  it('nunca apaga sem filtro: todo deleteMany leva a turma ou os ids dela', async () => {
    const { models, chamadas } = modelsFalsos();
    await excluirTurma(TURMA, models);
    for (const [nome, op, filtro] of chamadas) {
      if (op !== 'deleteMany') continue;
      expect(filtro, nome).toBeTruthy();
      expect(Object.keys(filtro).length, nome).toBeGreaterThan(0);
      expect(JSON.stringify(filtro), nome).toMatch(new RegExp(`${TURMA}|m1|e1`));
    }
    expect(chamadas.find(([n, op]) => n === 'Turma' && op === 'deleteOne')[2]).toEqual({ _id: TURMA });
  });

  it('devolve quanto saiu de cada parte', async () => {
    const { models } = modelsFalsos();
    const apagados = await excluirTurma(TURMA, models);
    expect(Object.keys(apagados)).toEqual(ORDEM.map(([parte]) => parte));
    expect(apagados.eventos).toBe(3);
  });
});

describe('contarDaTurma', () => {
  it('conta as mesmas partes que a exclusão apaga, sem apagar nada', async () => {
    const { models, chamadas } = modelsFalsos();
    const contagem = await contarDaTurma(TURMA, models);

    expect(Object.keys(contagem)).toEqual(ORDEM.map(([parte]) => parte));
    expect(chamadas.some(([, op]) => op.startsWith('delete'))).toBe(false);
  });
});
