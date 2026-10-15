import { describe, it, expect } from 'vitest';
import frequenciaService from '../frequenciaService.js';

const { calcularFrequencia, resumirFrequencias } = frequenciaService;

describe('calcularFrequencia', () => {
  it('mede a presença sobre as aulas que já aconteceram, não sobre o semestre', () => {
    // Meio do semestre: 40 de 80 aulas, nenhuma falta. Antes isso dava 50%.
    const r = calcularFrequencia({ totalClasses: 80, totalRegistered: 40, presences: 40, absences: 0 });

    expect(r.attendanceRate).toBe(100);
    expect(r.situacao).toBe('ok');
    expect(r.isAtRisk).toBe(false);
  });

  it('com nenhuma aula ainda, mostra 100% e não 0%', () => {
    const r = calcularFrequencia({ totalClasses: 80 });

    expect(r.attendanceRate).toBe(100);
    expect(r.absenceRate).toBe(0);
  });

  it('o limite é 25% do total de aulas do semestre', () => {
    const r = calcularFrequencia({ totalClasses: 78, totalRegistered: 30, presences: 26, absences: 4 });

    expect(r.maxAbsencesAllowed).toBe(19);
    expect(r.remainingAbsences).toBe(15);
  });

  it('avisa antes de estourar o limite', () => {
    // Limite 20; com 16 faltas restam 4, dentro da margem de aviso (5).
    const r = calcularFrequencia({ totalClasses: 80, totalRegistered: 50, presences: 34, absences: 16 });

    expect(r.situacao).toBe('atencao');
    expect(r.isAtRisk).toBe(true);
  });

  it('distingue quem está no limite de quem já passou dele', () => {
    const noLimite = calcularFrequencia({ totalClasses: 80, totalRegistered: 50, presences: 30, absences: 20 });
    const passou = calcularFrequencia({ totalClasses: 80, totalRegistered: 50, presences: 29, absences: 21 });

    expect(noLimite.situacao).toBe('no_limite');
    expect(passou.situacao).toBe('reprovado');
    expect(passou.remainingAbsences).toBe(0);
  });

  it('em matéria pequena, a margem de aviso é de pelo menos uma falta', () => {
    // 8 aulas: limite 2. Com 1 falta resta 1 — já é aviso.
    const r = calcularFrequencia({ totalClasses: 8, totalRegistered: 4, presences: 3, absences: 1 });

    expect(r.maxAbsencesAllowed).toBe(2);
    expect(r.situacao).toBe('atencao');
  });
});

describe('resumirFrequencias', () => {
  it('pondera a taxa geral pelas aulas de cada matéria', () => {
    const grande = calcularFrequencia({ totalClasses: 80, totalRegistered: 40, presences: 40, absences: 0 });
    const pequena = calcularFrequencia({ totalClasses: 4, totalRegistered: 2, presences: 0, absences: 2 });

    const r = resumirFrequencias([grande, pequena]);

    // 40 presenças em 42 aulas dadas, e não a média simples (100 + 0) / 2.
    expect(r.averageAttendanceRate).toBeCloseTo((40 / 42) * 100, 1);
    expect(r.subjectsAtRisk).toBe(1);
    expect(r.totalAbsences).toBe(2);
  });

  it('sem matérias, não divide por zero', () => {
    const r = resumirFrequencias([]);

    expect(r.averageAttendanceRate).toBe(100);
    expect(r.totalSubjects).toBe(0);
  });
});
