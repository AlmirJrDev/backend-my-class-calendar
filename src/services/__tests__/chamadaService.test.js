import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { horarioTipico, comoHora } = require('../chamadaService');

describe('horarioTipico', () => {
  it('cala a boca com um aviso só — não dá para chamar isso de costume', () => {
    expect(horarioTipico([1160])).toBeNull();
    expect(horarioTipico([])).toBeNull();
  });

  it('com dois avisos já arrisca', () => {
    expect(horarioTipico([1160, 1170])).toEqual({ minutoDoDia: 1165, amostras: 2 });
  });

  it('usa a mediana: um aviso atrasado não desloca o costume', () => {
    // 19:20, 19:22, 19:18 e um dia em que só avisaram às 22:00.
    const tipico = horarioTipico([1160, 1162, 1158, 1320]);
    expect(comoHora(tipico.minutoDoDia)).toBe('19:21');
  });

  it('olha só os avisos recentes', () => {
    // 10 avisos: os 8 primeiros (recentes) valem, os antigos ficam de fora.
    const recentes = [1160, 1160, 1160, 1160, 1160, 1160, 1160, 1160];
    const antigos = [600, 600];
    expect(horarioTipico([...recentes, ...antigos])).toEqual({ minutoDoDia: 1160, amostras: 8 });
  });
});

describe('comoHora', () => {
  it('formata com dois dígitos', () => {
    expect(comoHora(1160)).toBe('19:20');
    expect(comoHora(545)).toBe('09:05');
    expect(comoHora(0)).toBe('00:00');
  });
});
