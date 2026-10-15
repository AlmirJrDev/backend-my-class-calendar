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

  describe('média de médias (grupos)', () => {
    // M1 = (P1 + T1) / 2, M2 = (P2 + T2) / 2, final = (M1 + M2) / 2 → 0,25 cada.
    const mediaDeMedias = () => subject({
      gradeFormula: [
        { key: 'P1', label: 'Prova 1', weight: 0.25, grupo: 'M1' },
        { key: 'T1', label: 'Trabalho 1', weight: 0.25, grupo: 'M1' },
        { key: 'P2', label: 'Prova 2', weight: 0.25, grupo: 'M2' },
        { key: 'T2', label: 'Trabalho 2', weight: 0.25, grupo: 'M2' }
      ]
    });

    it('dá a mesma média final que calcular as médias parciais à mão', () => {
      const r = calculateGrade(mediaDeMedias(), { P1: 8, T1: 6, P2: 5, T2: 9 });
      // M1 = 7, M2 = 7 → 7.
      expect(r.partialScore).toBeCloseTo(7);
      expect(r.grupos).toEqual([
        { grupo: 'M1', peso: 0.5, media: 7, completo: true },
        { grupo: 'M2', peso: 0.5, media: 7, completo: true }
      ]);
    });

    it('mostra a média parcial de um grupo incompleto', () => {
      const r = calculateGrade(mediaDeMedias(), { P1: 8 });
      expect(r.grupos[0]).toMatchObject({ grupo: 'M1', media: 8, completo: false });
      expect(r.grupos[1]).toMatchObject({ grupo: 'M2', media: null, completo: false });
    });

    it('fórmula sem grupos devolve a lista de grupos vazia', () => {
      expect(calculateGrade(subject(), {}).grupos).toEqual([]);
    });
  });

  describe('nota mínima por instrumento', () => {
    const comMinimo = (exame) => subject({
      gradeFormula: [
        { key: 'P1', label: 'Prova 1', weight: 0.4, notaMinima: 4 },
        { key: 'P2', label: 'Prova 2', weight: 0.4, notaMinima: 4 },
        { key: 'AD', label: 'Atividades', weight: 0.2 }
      ],
      ...(exame && { exame })
    });

    it('a média passa, mas uma prova abaixo do mínimo reprova', () => {
      // 3 * 0.4 + 10 * 0.4 + 10 * 0.2 = 7.2, mas P1 = 3 < 4.
      const r = calculateGrade(comMinimo(), { P1: 3, P2: 10, AD: 10 });
      expect(r.partialScore).toBeCloseTo(7.2);
      expect(r.abaixoDoMinimo).toBe(true);
      expect(r.breakdown[0].abaixoDoMinimo).toBe(true);
      expect(r.status).toBe('reprovado');
    });

    it('sem exame, abaixo do mínimo antes do fim já é reprovação certa', () => {
      const r = calculateGrade(comMinimo(), { P1: 3 });
      expect(r.status).toBe('reprovado_matematicamente');
      expect(r.neededGrade).toBeNull();
      expect(r.projectedAverage).toBeNull();
    });

    it('a nota necessária nunca fica abaixo do mínimo do instrumento', () => {
      // AD = 10 → 2.0; faltam 4.0 em 0.8 de peso → 5 em cada, acima do mínimo 4.
      const r1 = calculateGrade(comMinimo(), { AD: 10 });
      expect(r1.breakdown[0].notaNecessaria).toBeCloseTo(5);

      // P1 = 10 e AD = 10 → 6.0; a parte igual seria 0, mas P2 precisa de 4.
      const r2 = calculateGrade(comMinimo(), { P1: 10, AD: 10 });
      expect(r2.breakdown[1].notaNecessaria).toBe(4);
      expect(r2.projectedAverage).toBeCloseTo(7.6);
    });

    it('redistribui entre os outros quando um instrumento fica preso no mínimo', () => {
      const s = subject({
        gradeFormula: [
          { key: 'P1', label: 'Prova 1', weight: 0.5, notaMinima: 7 },
          { key: 'T1', label: 'Trabalho', weight: 0.5 }
        ]
      });
      // Igual seria 6 em cada; P1 precisa de 7 → T1 precisa só de 5.
      const r = calculateGrade(s, {});
      expect(r.breakdown[0].notaNecessaria).toBe(7);
      expect(r.breakdown[1].notaNecessaria).toBeCloseTo(5);
      expect(r.projectedAverage).toBeCloseTo(6);
    });

    it('com exame, abaixo do mínimo leva ao exame em vez de reprovar', () => {
      const r = calculateGrade(comMinimo({ ativo: true }), { P1: 3, P2: 10, AD: 10 });
      expect(r.status).toBe('exame');
    });
  });

  describe('exame final', () => {
    const comExame = (exame = {}) => subject({ exame: { ativo: true, ...exame } });

    it('média abaixo da mínima, mas acima da do exame: vai para o exame', () => {
      // 5 em tudo = 5.0; padrão: exame com média ≥ 4, final = (média + exame) / 2 ≥ 5.
      const r = calculateGrade(comExame(), { P1: 5, P2: 5, AD: 5 });
      expect(r.status).toBe('exame');
      expect(r.exame.notaNecessaria).toBeCloseTo(5); // (5 − 0.5 × 5) / 0.5
    });

    it('com a nota do exame, decide pela média final', () => {
      const aprovado = calculateGrade(comExame(), { P1: 5, P2: 5, AD: 5, EXAME: 6 });
      expect(aprovado.exame.mediaFinal).toBeCloseTo(5.5);
      expect(aprovado.status).toBe('aprovado');

      const reprovado = calculateGrade(comExame(), { P1: 5, P2: 5, AD: 5, EXAME: 4 });
      expect(reprovado.status).toBe('reprovado');
    });

    it('média abaixo da necessária para o exame reprova direto', () => {
      const r = calculateGrade(comExame(), { P1: 3, P2: 3, AD: 3 });
      expect(r.status).toBe('reprovado');
    });

    it('respeita pesos e notas configurados', () => {
      // Final = 0.6 × média + 0.4 × exame ≥ 6; média 5 → exame ≥ 7.5.
      const r = calculateGrade(comExame({ pesoDaMedia: 0.6, notaFinalMinima: 6, mediaMinimaParaExame: 3 }), { P1: 5, P2: 5, AD: 5 });
      expect(r.exame.notaNecessaria).toBeCloseTo(7.5);
    });

    it('quando nem 10 em tudo passa direto, mas ainda dá exame, avisa o caminho', () => {
      // 1 e 1 nas provas: passar direto é impossível, mas a média pode chegar a 2.8... abaixo de 4.
      const semChance = calculateGrade(comExame(), { P1: 1, P2: 1 });
      expect(semChance.status).toBe('reprovado_matematicamente');

      // 3 e 3: o máximo é 4.4 — não passa direto, mas alcança o exame.
      const r = calculateGrade(comExame(), { P1: 3, P2: 3 });
      expect(r.status).toBe('em_andamento');
      expect(r.rumoAoExame).toBe(true);
      expect(r.neededGrade).toBeNull();
    });

    it('quem passa direto não vê exame', () => {
      const r = calculateGrade(comExame(), { P1: 7, P2: 7, AD: 7 });
      expect(r.status).toBe('aprovado');
      expect(r.exame.notaNecessaria).toBeNull();
    });

    it('sem exame configurado, o campo vem nulo', () => {
      expect(calculateGrade(subject(), {}).exame).toBeNull();
    });
  });

  it('devolve o breakdown na mesma ordem da fórmula', () => {
    const r = calculateGrade(subject(), { P1: 7 });

    expect(r.breakdown.map((i) => i.key)).toEqual(['P1', 'P2', 'AD']);
    expect(r.breakdown[0]).toMatchObject({ key: 'P1', label: 'Prova 1', weight: 0.4 });
  });
});
