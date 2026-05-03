/**
 * Calcula média atual, nota necessária nos instrumentos restantes,
 * e status de aprovação dado um subject com gradeFormula e as notas do aluno.
 *
 * Estratégia "distribuição igual":
 *   nota_necessária = (minimumGrade - soma_parcial) / soma_pesos_restantes
 *
 * Isso responde "se eu tirar a mesma nota em tudo que falta, quanto preciso?"
 */
exports.calculateGrade = (subject, gradesMap) => {
  const formula     = subject.gradeFormula;   // [{ key, label, weight, date }]
  const minimum     = subject.minimumGrade ?? 6.0;
  const grades      = gradesMap || {};        // objeto simples { P1: 7.5, AD: null }

  let partialScore    = 0;  // soma(nota_i * peso_i) das notas preenchidas
  let partialWeight   = 0;  // soma dos pesos já avaliados
  let remainingWeight = 0;  // soma dos pesos ainda não avaliados

  const breakdown = formula.map(instrument => {
    const { key, label, weight, date } = instrument;
    const rawGrade = grades[key];
    const grade    = rawGrade !== null && rawGrade !== undefined ? Number(rawGrade) : null;
    const filled   = grade !== null && !isNaN(grade);

    if (filled) {
      partialScore  += grade * weight;
      partialWeight += weight;
    } else {
      remainingWeight += weight;
    }

    return { key, label, weight, date, grade, filled };
  });

  const allFilled = remainingWeight === 0;

  // Média final (se tudo preenchido) ou parcial ponderada
  const currentAverage = allFilled
    ? partialScore
    : partialWeight > 0
      ? partialScore / partialWeight   // média só dos instrumentos avaliados (informativo)
      : null;

  // Nota necessária em cada instrumento restante (igual para todos — distribuição igual)
  let neededGrade = null;
  let mathematicallyFailed = false;

  if (!allFilled) {
    neededGrade = (minimum - partialScore) / remainingWeight;

    if (neededGrade > 10) {
      mathematicallyFailed = true; // impossível passar mesmo com 10 em tudo
      neededGrade = null;
    } else if (neededGrade <= 0) {
      neededGrade = 0; // já garantiu a média — qualquer nota serve
    }
  }

  // Status
  let status;
  if (mathematicallyFailed) {
    status = 'reprovado_matematicamente';
  } else if (allFilled) {
    status = partialScore >= minimum ? 'aprovado' : 'reprovado';
  } else {
    status = 'em_andamento';
  }

  // Projeção: se o aluno tirar `neededGrade` em todos os restantes
  const projectedAverage = !allFilled && neededGrade !== null
    ? partialScore + (neededGrade * remainingWeight)
    : null;

  return {
    breakdown,             // array com cada instrumento e sua nota
    partialScore,          // pontuação acumulada até agora
    partialWeight,         // peso já avaliado
    remainingWeight,       // peso ainda por avaliar
    currentAverage,        // média dos já avaliados (informativo)
    neededGrade,           // nota necessária nos restantes (igual para todos)
    projectedAverage,      // média final projetada se atingir neededGrade
    status,                // 'em_andamento' | 'aprovado' | 'reprovado' | 'reprovado_matematicamente'
    minimum,               // nota mínima para aprovação
    allFilled
  };
};