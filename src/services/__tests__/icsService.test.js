import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { gerarCalendario, _internos } = require('../icsService');
const { escapar, dobrar, diaEmBrasilia } = _internos;

// Como o app grava: meia-noite de Brasília = 03:00 UTC.
const DIA_28 = '2026-09-28T03:00:00.000Z';

const evento = (partes = {}) => ({
  _id: 'ev1',
  title: 'P1 — Estrutura de Dados',
  type: 'exam',
  date: DIA_28,
  updatedAt: '2026-09-20T12:00:00.000Z',
  ...partes
});

/** Desfaz a quebra de linha para procurar campos inteiros. */
const desdobrar = (ics) => ics.replace(/\r\n /g, '');
// Procura só dentro do evento: o bloco de fuso horário também tem DTSTART.
const linhaDe = (ics, campo) =>
  desdobrar(ics).split('BEGIN:VEVENT')[1].split('\r\n').find((l) => l.startsWith(campo));

describe('gerarCalendario', () => {
  it('evento com horário usa o fuso de Brasília e dura uma hora por padrão', () => {
    const ics = gerarCalendario([evento({ time: '20:45' })]);
    expect(linhaDe(ics, 'DTSTART')).toBe('DTSTART;TZID=America/Sao_Paulo:20260928T204500');
    expect(linhaDe(ics, 'DTEND')).toBe('DTEND;TZID=America/Sao_Paulo:20260928T214500');
  });

  it('usa o término quando existe', () => {
    const ics = gerarCalendario([evento({ time: '19:00', endTime: '22:15' })]);
    expect(linhaDe(ics, 'DTEND')).toBe('DTEND;TZID=America/Sao_Paulo:20260928T221500');
  });

  it('sem horário vira dia inteiro, com fim exclusivo no dia seguinte', () => {
    const ics = gerarCalendario([evento()]);
    expect(linhaDe(ics, 'DTSTART')).toBe('DTSTART;VALUE=DATE:20260928');
    expect(linhaDe(ics, 'DTEND')).toBe('DTEND;VALUE=DATE:20260929');
  });

  it('o dia não escorrega para trás em servidor UTC', () => {
    // 03:00 UTC ainda é dia 28 em Brasília; ler em UTC puro também dá 28, mas
    // 00:30 UTC do dia 29 é 21:30 do dia 28 em Brasília.
    expect(diaEmBrasilia('2026-09-29T00:30:00.000Z')).toEqual({ ano: 2026, mes: 9, dia: 28 });
  });

  it('título diz o tipo e, com várias turmas, de qual turma é — no fim', () => {
    const ics = gerarCalendario([evento({ turmaNome: 'Faculdade' })]);
    expect(linhaDe(ics, 'SUMMARY')).toBe('SUMMARY:Prova: P1 — Estrutura de Dados · Faculdade');
  });

  it('leva matéria, descrição, local e link do app', () => {
    const ics = gerarCalendario(
      [evento({ subject: 'Estruturas', description: 'Cap. 3 ao 5', location: 'Sala 204' })],
      { linkDoApp: 'https://app.exemplo/dashboard' }
    );
    expect(linhaDe(ics, 'LOCATION')).toBe('LOCATION:Sala 204');
    expect(linhaDe(ics, 'DESCRIPTION')).toBe(
      'DESCRIPTION:Matéria: Estruturas\\n\\nCap. 3 ao 5\\n\\nAbrir no app: https://app.exemplo/dashboard'
    );
    expect(linhaDe(ics, 'URL')).toBe('URL:https://app.exemplo/dashboard');
  });

  it('põe lembrete de um dia antes nas provas', () => {
    const ics = desdobrar(gerarCalendario([evento()]));
    expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY');
    expect(ics).toContain('TRIGGER:-P1D');
  });

  it('aula recorrente vira regra semanal com fim', () => {
    const ics = gerarCalendario([evento({ type: 'class', recurring: true, daysOfWeek: [1, 3], time: '19:00' })]);
    expect(linhaDe(ics, 'RRULE')).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20270328T235959Z');
  });

  it('usa CRLF e o identificador é estável', () => {
    const ics = gerarCalendario([evento()]);
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(linhaDe(ics, 'UID')).toBe('UID:ev1@myclasscalendar');
  });

  it('calendário vazio ainda é válido', () => {
    const ics = gerarCalendario([]);
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});

describe('escapar', () => {
  it('escapa vírgula, ponto e vírgula, barra e quebra de linha', () => {
    expect(escapar('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });
});

describe('dobrar', () => {
  it('quebra linhas longas sem partir acento, e cada pedaço cabe em 75 bytes', () => {
    const longa = 'SUMMARY:' + 'ação '.repeat(40);
    const dobrada = dobrar(longa);
    for (const parte of dobrada.split('\r\n')) {
      expect(Buffer.byteLength(parte, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(dobrada.replace(/\r\n /g, '')).toBe(longa);
  });

  it('não mexe em linha curta', () => {
    expect(dobrar('SUMMARY:curto')).toBe('SUMMARY:curto');
  });
});
