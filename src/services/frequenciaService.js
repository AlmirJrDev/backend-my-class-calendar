/**
 * Frequência de uma matéria a partir das contagens de presença e falta.
 *
 * Duas regras que a versão antiga errava:
 * - A taxa de presença é sobre as aulas que JÁ aconteceram, não sobre o
 *   semestre inteiro. Senão, no meio do semestre, quem nunca faltou aparecia
 *   com 50% e levava alerta de "frequência baixa".
 * - "Em risco" acende antes de estourar o limite, e não só depois — depois
 *   não há mais o que fazer.
 */

/** Parte do total de aulas que se pode faltar sem reprovar. */
const LIMITE_DE_FALTAS = 0.25;

/**
 * Quantas faltas restantes já merecem aviso: um quarto do limite, e no mínimo
 * uma. Com 80 aulas (limite 20), avisa a partir de 5 faltas restantes.
 */
const margemDeAviso = (maximo) => Math.max(1, Math.floor(maximo * 0.25));

const arredondar = (n) => Math.round(n * 100) / 100;

exports.LIMITE_DE_FALTAS = LIMITE_DE_FALTAS;

exports.calcularFrequencia = ({ totalClasses = 0, presences = 0, absences = 0, totalRegistered = 0 }) => {
  const maxAbsencesAllowed = Math.floor(totalClasses * LIMITE_DE_FALTAS);
  const remainingAbsences = Math.max(0, maxAbsencesAllowed - absences);

  let situacao;
  if (absences > maxAbsencesAllowed) situacao = 'reprovado';
  else if (remainingAbsences === 0) situacao = 'no_limite';
  else if (remainingAbsences <= margemDeAviso(maxAbsencesAllowed)) situacao = 'atencao';
  else situacao = 'ok';

  // Sem nenhuma aula ainda, ninguém faltou: 100%, e não 0%.
  const attendanceRate = totalRegistered > 0 ? (presences / totalRegistered) * 100 : 100;
  const absenceRate = totalRegistered > 0 ? (absences / totalRegistered) * 100 : 0;
  const registeredRate = totalClasses > 0 ? (totalRegistered / totalClasses) * 100 : 0;

  return {
    totalClasses,
    totalRegistered,
    classesRemaining: Math.max(0, totalClasses - totalRegistered),
    absences,
    presences,
    attendanceRate: arredondar(attendanceRate),
    absenceRate: arredondar(absenceRate),
    registeredRate: arredondar(registeredRate),
    maxAbsencesAllowed,
    remainingAbsences,
    situacao,
    isAtRisk: situacao !== 'ok'
  };
};

/**
 * Resumo de todas as matérias. A taxa geral é ponderada pelas aulas de cada
 * matéria — a média simples das taxas deixaria uma matéria de 2 aulas pesar
 * igual a uma de 80.
 */
exports.resumirFrequencias = (materias) => {
  const soma = (campo) => materias.reduce((total, m) => total + (m[campo] || 0), 0);
  const presencas = soma('presences');
  const registradas = soma('totalRegistered');

  return {
    totalSubjects: materias.length,
    subjectsAtRisk: materias.filter((m) => m.isAtRisk).length,
    totalClasses: soma('totalClasses'),
    totalRegistered: registradas,
    totalAbsences: soma('absences'),
    totalPresences: presencas,
    averageAttendanceRate: registradas > 0 ? arredondar((presencas / registradas) * 100) : 100,
    subjects: materias
  };
};
