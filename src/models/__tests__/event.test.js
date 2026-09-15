import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Event = require('../event');

const base = {
  title: 'P1',
  type: 'exam',
  date: new Date('2026-09-23T03:00:00.000Z'),
  userId: '6aa88f86fff3c43741af8281'
};

const erros = (dados) => {
  const erro = new Event({ ...base, ...dados }).validateSync();
  return erro ? Object.keys(erro.errors) : [];
};

describe('Event — término e local', () => {
  it('aceita término no formato HH:mm', () => {
    expect(erros({ time: '10:00', endTime: '12:30', location: 'Lab 2' })).toEqual([]);
    expect(erros({ endTime: '23:59' })).toEqual([]);
    expect(erros({ endTime: '09:05' })).toEqual([]);
  });

  it('recusa término fora do formato', () => {
    expect(erros({ endTime: '24:00' })).toContain('endTime');
    expect(erros({ endTime: '9:00' })).toContain('endTime');
    expect(erros({ endTime: 'meio-dia' })).toContain('endTime');
  });

  it('limita o tamanho do local', () => {
    expect(erros({ location: 'x'.repeat(121) })).toContain('location');
  });
});
