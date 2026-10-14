import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { marcasDeData, camposDoEvento } = require('../eventoService');
const { validarPlano, planejarEventos } = require('../planoService');
const { gerarCalendario } = require('../icsService');

// A AT2 de Redes: quinta, 15/10, gravada à meia-noite de Brasília.
const at2 = { date: new Date('2026-10-15T03:00:00.000Z') };

describe('marcasDeData', () => {
  it('mudar o dia marca a data como da turma e encerra o adiamento', () => {
    expect(marcasDeData(at2, { date: '2026-10-22T03:00:00.000Z' })).toEqual({
      dataAlteradaNaTurma: true,
      adiado: false,
    });
  });

  it('mudar só o horário, ou mandar o mesmo dia, não mexe em nada', () => {
    expect(marcasDeData(at2, { time: '19:00' })).toEqual({});
    expect(marcasDeData(at2, { date: '2026-10-15T03:00:00.000Z' })).toEqual({});
  });

  it('adiar também é decisão da turma sobre a data', () => {
    expect(marcasDeData(at2, { adiado: true })).toEqual({ dataAlteradaNaTurma: true });
  });

  it('nova data com adiado explícito respeita o que veio', () => {
    expect(marcasDeData(at2, { date: '2026-10-22T03:00:00.000Z', adiado: true })).toEqual({ dataAlteradaNaTurma: true });
  });

  it('data inválida não marca nada', () => {
    expect(marcasDeData(at2, { date: 'lixo' })).toEqual({});
  });

  it('adiado é um campo editável; a marca de data da turma não vem do corpo', () => {
    expect(camposDoEvento({ adiado: true, dataAlteradaNaTurma: false })).toEqual({ adiado: true });
  });
});

describe('reimportar o plano não desfaz a data da turma', () => {
  const plano = validarPlano({
    gradeFormula: [
      { key: 'AT2', label: 'Atividade 2', weight: 0.4, date: '2026-10-15' },
      { key: 'P1', label: 'Prova 1', weight: 0.6, date: '2026-12-02' },
    ],
    eventos: [{ key: 'AT2', title: 'AT2 — Atividade 2', type: 'exam', date: '2026-10-15' }],
  }).plano;
  const materia = { _id: 'm1', name: 'Redes', schedule: [{ dayOfWeek: 4, periods: [4, 5] }] };
  const existente = (partes) => ({
    _id: 'e1',
    title: 'AT2 — Atividade 2',
    type: 'exam',
    gradeKey: 'AT2',
    subjectId: 'm1',
    time: '21:30',
    ...partes,
  });

  it('prova adiada fica onde está e a prévia diz por quê', () => {
    const [acao] = planejarEventos(plano, materia, [
      existente({ date: new Date('2026-10-15T03:00:00.000Z'), adiado: true, dataAlteradaNaTurma: true }),
    ]);
    expect(acao).toMatchObject({ acao: 'manter', motivo: 'adiada na turma; mantida' });
    expect(acao.evento.date).toBe('2026-10-15');
  });

  it('prova remarcada pela turma não volta para a data do plano', () => {
    const [acao] = planejarEventos(plano, materia, [
      existente({ date: new Date('2026-10-22T03:00:00.000Z'), dataAlteradaNaTurma: true }),
    ]);
    expect(acao.evento.date).toBe('2026-10-22');
    expect(acao.motivo).toBe('data mudada na turma; mantida');
  });

  it('sem mudança na turma, o plano continua mandando na data', () => {
    const [acao] = planejarEventos(plano, materia, [existente({ date: new Date('2026-10-08T03:00:00.000Z') })]);
    expect(acao).toMatchObject({ acao: 'atualizar' });
    expect(acao.evento.date).toBe('2026-10-15');
    expect(acao.motivo).toBeUndefined();
  });
});

describe('calendário assinado no celular', () => {
  const evento = {
    _id: 'e1',
    title: 'AT2 — Atividade 2',
    type: 'exam',
    date: new Date('2026-10-15T03:00:00.000Z'),
    time: '21:30',
  };

  it('a prova adiada aparece como ADIADA no dia original', () => {
    const ics = gerarCalendario([{ ...evento, adiado: true }]).replace(/\r\n /g, '');
    expect(ics).toMatch(/SUMMARY:Prova: ADIADA — AT2 — Atividade 2 \(nova data a definir\)/);
  });

  it('prova normal sai como sempre', () => {
    const ics = gerarCalendario([evento]).replace(/\r\n /g, '');
    expect(ics).toMatch(/SUMMARY:Prova: AT2 — Atividade 2/);
    expect(ics).not.toMatch(/ADIADA/);
  });
});
