import { describe, it, expect } from 'vitest';
import {
  validarPlano,
  planejarEventos,
  mudancasDaMateria,
  camposDaMateria,
  camposDoEventoDoPlano,
} from '../planoService';

const corpoRedes = () => ({
  code: 'G4428.12',
  teacher: 'Clevison Lamas Veloso',
  minimumGrade: 6,
  gradeFormula: [
    { key: 'at1', label: 'Atividade 1', weight: 0.1, date: '2026-09-17' },
    { key: 'AT2', label: 'Atividade 2', weight: 0.1, date: '2026-10-15' },
    { key: 'AT3', label: 'Atividade 3', weight: 0.1, date: '2026-11-04' },
    { key: 'PI', label: 'Prova Interdisciplinar', weight: 0.1, date: '2026-11-18' },
    { key: 'P1', label: 'Prova 1', weight: 0.6, date: '2026-12-02' },
  ],
  eventos: [
    { key: 'AT1', title: 'AT1 — Atividade 1', type: 'assignment', date: '2026-09-17' },
    { key: 'PI', title: 'PI — Prova Interdisciplinar', type: 'exam', date: '2026-11-18', compartilhado: true },
    { key: 'P1', title: 'P1 — Prova 1', type: 'exam', date: '2026-12-02' },
    { title: 'SUB1 — Substitutiva', type: 'exam', date: '2026-12-09' },
  ],
});

// Quarta (3) períodos 1-2 e quinta (4) períodos 4-5.
const materia = {
  _id: 'm1',
  name: 'Redes de Computadores',
  teacher: 'A definir',
  schedule: [
    { dayOfWeek: 3, periods: [1, 2] },
    { dayOfWeek: 4, periods: [4, 5] },
  ],
  gradeFormula: [],
};

const ev = (partes) => ({ _id: 'e1', type: 'exam', ...partes, date: new Date(`${partes.date}T03:00:00.000Z`) });

describe('validarPlano', () => {
  it('aceita o plano de Redes e normaliza a chave', () => {
    const { erros, plano } = validarPlano(corpoRedes());
    expect(erros).toEqual([]);
    expect(plano.gradeFormula[0].key).toBe('AT1');
    expect(plano.eventos).toHaveLength(4);
  });

  it('recusa pesos que não somam 1', () => {
    const corpo = corpoRedes();
    corpo.gradeFormula[4].weight = 0.5;
    expect(validarPlano(corpo).erros.join(' ')).toMatch(/somam 0.9/);
  });

  it('recusa fórmula vazia', () => {
    expect(validarPlano({ gradeFormula: [] }).erros.join(' ')).toMatch(/fórmula/);
  });

  it('recusa avaliação apontando para item fora da fórmula', () => {
    const corpo = corpoRedes();
    corpo.eventos.push({ key: 'XX', title: 'XX', type: 'exam', date: '2026-12-10' });
    expect(validarPlano(corpo).erros.join(' ')).toMatch(/XX/);
  });

  it('recusa chave repetida, data e tipo inválidos', () => {
    const corpo = corpoRedes();
    corpo.gradeFormula[1].key = 'AT1';
    corpo.eventos[0].date = '17/09/2026';
    corpo.eventos[2].type = 'banana';
    const texto = validarPlano(corpo).erros.join(' ');
    expect(texto).toMatch(/duas vezes/);
    expect(texto).toMatch(/data de "AT1/);
    expect(texto).toMatch(/tipo de "P1/);
  });

  it('ignora média mínima fora de 0 a 10', () => {
    expect(validarPlano({ ...corpoRedes(), minimumGrade: 60 }).plano.minimumGrade).toBeUndefined();
  });

  it('aceita grupo, nota mínima por item e exame, e grava os três', () => {
    const corpo = corpoRedes();
    corpo.gradeFormula[4].notaMinima = 4;
    corpo.gradeFormula[0].grupo = 'm1';
    corpo.exame = { ativo: true, mediaMinimaParaExame: 4, notaFinalMinima: 5 };

    const { erros, plano } = validarPlano(corpo);
    expect(erros).toEqual([]);
    expect(plano.gradeFormula[0].grupo).toBe('M1');
    expect(plano.gradeFormula[4].notaMinima).toBe(4);
    expect(plano.exame).toEqual({ ativo: true, mediaMinimaParaExame: 4, notaFinalMinima: 5 });

    const campos = camposDaMateria(plano);
    expect(campos.gradeFormula[4].notaMinima).toBe(4);
    expect(campos.exame.ativo).toBe(true);
  });

  it('recusa nota mínima e exame fora do intervalo', () => {
    const corpo = corpoRedes();
    corpo.gradeFormula[4].notaMinima = 11;
    corpo.exame = { ativo: true, pesoDaMedia: 1 };
    const texto = validarPlano(corpo).erros.join(' ');
    expect(texto).toMatch(/nota mínima de P1/);
    expect(texto).toMatch(/pesoDaMedia/);
  });

  it('plano sem exame não mexe no exame da matéria', () => {
    expect(camposDaMateria(validarPlano(corpoRedes()).plano)).not.toHaveProperty('exame');
  });
});

describe('planejarEventos', () => {
  const plano = () => validarPlano(corpoRedes()).plano;

  it('cria o que não existe, com o horário da aula do dia', () => {
    const acoes = planejarEventos(plano(), materia);
    const p1 = acoes.find((a) => a.evento.key === 'P1');
    expect(p1).toMatchObject({ acao: 'criar' });
    expect(p1.evento.time).toBe('19:00'); // quarta
    expect(acoes.find((a) => a.evento.key === 'AT1').evento.time).toBe('21:30'); // quinta
  });

  it('o evento "Prova" anunciado em aula vira a AT1, sem duplicar', () => {
    const antigo = ev({ _id: 'antigo', title: 'Prova', date: '2026-09-17', time: '21:30' });
    const [at1] = planejarEventos(plano(), materia, [antigo]);
    expect(at1).toMatchObject({ acao: 'atualizar', existenteId: 'antigo', tituloAntes: 'Prova' });
    expect(at1.evento.time).toBe('21:30');
  });

  it('acha o evento pelo item da fórmula mesmo se a data mudou', () => {
    const antigo = ev({ _id: 'x', title: 'P1', date: '2026-11-30', gradeKey: 'p1' });
    const p1 = planejarEventos(plano(), materia, [antigo]).find((a) => a.evento.key === 'P1');
    expect(p1).toMatchObject({ acao: 'atualizar', existenteId: 'x' });
  });

  it('não casa por data um evento já ligado a outro item da nota', () => {
    const outro = ev({ _id: 'o', title: 'Outra', date: '2026-09-17', gradeKey: 'AT9' });
    const [at1] = planejarEventos(plano(), materia, [outro]);
    expect(at1.acao).toBe('criar');
  });

  it('não reaproveita o mesmo evento para duas avaliações', () => {
    const p = validarPlano({
      ...corpoRedes(),
      eventos: [
        { key: 'AT1', title: 'AT1 — Atividade 1', type: 'exam', date: '2026-09-17' },
        { key: 'P1', title: 'P1 — Prova 1', type: 'exam', date: '2026-09-17' },
      ],
    }).plano;
    const acoes = planejarEventos(p, materia, [ev({ _id: 'u', title: 'Prova', date: '2026-09-17' })]);
    expect(acoes.map((a) => a.acao)).toEqual(['atualizar', 'criar']);
  });

  it('mantém o que já está igual', () => {
    const igual = ev({
      _id: 'i',
      title: 'P1 — Prova 1',
      date: '2026-12-02',
      gradeKey: 'P1',
      subjectId: 'm1',
      time: '19:00',
    });
    const p1 = planejarEventos(plano(), materia, [igual]).find((a) => a.evento.key === 'P1');
    expect(p1.acao).toBe('manter');
  });

  it('a prova interdisciplinar não é criada de novo se a turma já tem', () => {
    const pi = ev({ _id: 'pi', title: 'PI — Prova Interdisciplinar', date: '2026-11-18' });
    const acoes = planejarEventos(plano(), materia, [], [pi]);
    expect(acoes.find((a) => a.evento.key === 'PI')).toMatchObject({ acao: 'manter', existenteId: 'pi' });
  });

  it('cria a interdisciplinar sem matéria se a turma ainda não tem', () => {
    const pi = planejarEventos(plano(), materia).find((a) => a.evento.key === 'PI');
    expect(pi.acao).toBe('criar');
    const campos = camposDoEventoDoPlano(pi, materia);
    expect(campos.subjectId).toBeUndefined();
    expect(campos.gradeKey).toBeUndefined();
  });
});

describe('gravação', () => {
  it('liga o evento à matéria e ao item da fórmula', () => {
    const [at1] = planejarEventos(validarPlano(corpoRedes()).plano, materia);
    expect(camposDoEventoDoPlano(at1, materia)).toMatchObject({
      subject: 'Redes de Computadores',
      subjectId: 'm1',
      gradeKey: 'AT1',
      date: new Date('2026-09-17T03:00:00.000Z'),
    });
  });

  it('a fórmula grava as datas como meia-noite de Brasília', () => {
    const campos = camposDaMateria(validarPlano(corpoRedes()).plano);
    expect(campos.gradeFormula[4].date.toISOString()).toBe('2026-12-02T03:00:00.000Z');
    expect(campos.teacher).toBe('Clevison Lamas Veloso');
  });

  it('mostra só o que muda na matéria', () => {
    const { plano } = validarPlano(corpoRedes());
    const mudancas = mudancasDaMateria(plano, { ...materia, code: 'G4428.12', minimumGrade: 6 });
    expect(mudancas.map((m) => m.campo)).toEqual(['teacher']);
    expect(mudancas[0]).toMatchObject({ antes: 'A definir', depois: 'Clevison Lamas Veloso' });
  });
});
