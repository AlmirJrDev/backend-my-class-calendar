import { describe, it, expect } from 'vitest';
import gradeService from '../gradeService.js';

const { calculateGrade } = gradeService;

// Fórmula padrão: pesos somando 1.0, então partialScore já é a média ponderada.
const subject = (overrides = {}) => ({
  gradeFormula: [
    { key: 'P1', label: 'Prova 1', weight: 0.4 },
    { key: 'P2', label: 'Prova 2', weight: 0.4 },
    { key: 'AD', label: 'Atividades', weight: 0.2 }
  ],
  minimumGrade: 6,
  ...overrides
});

describe('calculateGrade', () => {
  describe('quando todas as notas estão preenchidas', () => {
    it('aprova quem atinge a nota mínima', () => {
      const r = calculateGrade(subject(), { P1: 7, P2: 6, AD: 8 });

      expect(r.allFilled).toBe(true);
      expect(r.partialScore).toBeCloseTo(6.8); // 7*0.4 + 6*0.4 + 8*0.2
      expect(r.status).toBe('aprovado');
      expect(r.neededGrade).toBeNull();
      expect(r.remainingWeight).toBe(0);
    });

    it('reprova quem fica abaixo da mínima', () => {
      const r = calculateGrade(subject(), { P1: 5, P2: 5, AD: 5 });

      expect(r.partialScore).toBeCloseTo(5.0);
      expect(r.status).toBe('reprovado');
    });

    it('aprova em cima do limite exato', () => {
      const r = calculateGrade(subject(), { P1: 6, P2: 6, AD: 6 });

      expect(r.partialScore).toBeCloseTo(6.0);
      expect(r.status).toBe('aprovado');
    });
  });

  describe('quando ainda faltam notas', () => {
    it('calcula quanto falta distribuindo igualmente no que resta', () => {
      // 8 * 0.4 = 3.2 acumulado; faltam 0.6 de peso para chegar em 6.
      const r = calculateGrade(subject(), { P1: 8 });

      expect(r.status).toBe('em_andamento');
      expect(r.partialScore).toBeCloseTo(3.2);
      expect(r.partialWeight).toBeCloseTo(0.4);
      expect(r.remainingWeight).toBeCloseTo(0.6);
      expect(r.neededGrade).toBeCloseTo((6 - 3.2) / 0.6); // ≈ 4.67
    });

    it('projeta a média final assumindo a nota necessária', () => {
      const r = calculateGrade(subject(), { P1: 8 });

      expect(r.projectedAverage).toBeCloseTo(6.0);
    });

    it('zera a nota necessária para quem já garantiu a média', () => {
      // 10 e 10 nas provas = 8.0 acumulado, acima da mínima de 6.
      const r = calculateGrade(subject(), { P1: 10, P2: 10 });

      expect(r.neededGrade).toBe(0);
      expect(r.status).toBe('em_andamento');
    });

    it('marca reprovação matemática quando nem 10 em tudo salva', () => {
      // 1 e 1 nas provas = 0.8; faltaria 26 na atividade de peso 0.2.
      const r = calculateGrade(subject(), { P1: 1, P2: 1 });

      expect(r.status).toBe('reprovado_matematicamente');
      expect(r.neededGrade).toBeNull();
      expect(r.projectedAverage).toBeNull();
    });

    it('devolve currentAverage nulo quando nada foi avaliado', () => {
      const r = calculateGrade(subject(), {});

      expect(r.currentAverage).toBeNull();
      expect(r.partialWeight).toBe(0);
      expect(r.status).toBe('em_andamento');
    });

    it('usa currentAverage como média apenas do que já foi avaliado', () => {
      // Média informativa: 3.2 / 0.4 = 8, e não a pontuação acumulada.
      const r = calculateGrade(subject(), { P1: 8 });

      expect(r.currentAverage).toBeCloseTo(8);
    });
  });

  describe('tratamento das notas recebidas', () => {
    it('trata zero como nota preenchida, não como ausência', () => {
      const r = calculateGrade(subject(), { P1: 0 });
      const p1 = r.breakdown.find((i) => i.key === 'P1');

      expect(p1.filled).toBe(true);
      expect(p1.grade).toBe(0);
      expect(r.partialWeight).toBeCloseTo(0.4);
    });

    it('trata null e undefined como ainda não avaliado', () => {
      const r = calculateGrade(subject(), { P1: null, P2: undefined });

      expect(r.remainingWeight).toBeCloseTo(1.0);
      expect(r.partialWeight).toBe(0);
    });

    it('trata valor não numérico como ainda não avaliado', () => {
      const r = calculateGrade(subject(), { P1: 'abc' });

      expect(r.breakdown.find((i) => i.key === 'P1').filled).toBe(false);
      expect(r.remainingWeight).toBeCloseTo(1.0);
      expect(Number.isNaN(r.partialScore)).toBe(false);
    });

    it('aceita nota em string numérica', () => {
      const r = calculateGrade(subject(), { P1: '8' });

      expect(r.breakdown.find((i) => i.key === 'P1').grade).toBe(8);
      expect(r.partialScore).toBeCloseTo(3.2);
    });

    it('ignora chaves que não estão na fórmula', () => {
      const r = calculateGrade(subject(), { P1: 8, INEXISTENTE: 10 });

      expect(r.breakdown).toHaveLength(3);
      expect(r.partialScore).toBeCloseTo(3.2);
    });

    it('funciona sem receber mapa de notas', () => {
      const r = calculateGrade(subject(), undefined);

      expect(r.partialWeight).toBe(0);
      expect(r.status).toBe('em_andamento');
    });
  });

  describe('nota mínima', () => {
    it('usa 6.0 quando a matéria não define uma', () => {
      const r = calculateGrade(subject({ minimumGrade: undefined }), { P1: 6, P2: 6, AD: 6 });

      expect(r.minimum).toBe(6);
      expect(r.status).toBe('aprovado');
    });

    it('respeita mínima zero em vez de cair no padrão', () => {
      const r = calculateGrade(subject({ minimumGrade: 0 }), { P1: 0, P2: 0, AD: 0 });

      expect(r.minimum).toBe(0);
      expect(r.status).toBe('aprovado');
    });

    it('respeita uma mínima customizada', () => {
      const r = calculateGrade(subject({ minimumGrade: 7 }), { P1: 6, P2: 6, AD: 6 });

      expect(r.status).toBe('reprovado');
    });
  });

  it('devolve o breakdown na mesma ordem da fórmula', () => {
    const r = calculateGrade(subject(), { P1: 7 });

    expect(r.breakdown.map((i) => i.key)).toEqual(['P1', 'P2', 'AD']);
    expect(r.breakdown[0]).toMatchObject({ key: 'P1', label: 'Prova 1', weight: 0.4 });
  });
});
