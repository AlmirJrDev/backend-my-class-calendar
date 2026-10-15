/**
 * Calcula média atual, nota necessária nos instrumentos restantes,
 * e status de aprovação dado um subject com gradeFormula e as notas do aluno.
 *
 * Estratégia "distribuição igual":
 *   nota_necessária = (minimumGrade - soma_parcial) / soma_pesos_restantes
 *
 * Isso responde "se eu tirar a mesma nota em tudo que falta, quanto preciso?"
 *
 * Três extensões, todas opcionais e compatíveis com as fórmulas antigas:
 *
 * - Grupos (média de médias): cada instrumento pode ter um `grupo` (ex.: "M1").
 *   O peso continua sendo o peso EFETIVO na média final — (M1 + M2) / 2 com
 *   M1 = (P1 + T1) / 2 é o mesmo que 0,25 para cada um —, então a conta não
 *   muda; o grupo serve para mostrar a média de cada parte.
 * - Nota mínima por instrumento (`notaMinima`): ficar abaixo dela impede a
 *   aprovação direta, mesmo com média suficiente. Nos restantes, a nota
 *   necessária nunca fica abaixo do mínimo daquele instrumento.
 * - Exame final (`subject.exame`): quem não passa direto mas tem média de pelo
 *   menos `mediaMinimaParaExame` vai para o exame; a média final é
 *   pesoDaMedia × média + (1 − pesoDaMedia) × exame, e aprova com
 *   `notaFinalMinima`. A nota do exame fica nas notas do aluno sob a chave EXAME.
 */

const CHAVE_DO_EXAME = 'EXAME';
exports.CHAVE_DO_EXAME = CHAVE_DO_EXAME;

const lerNota = (bruta) => {
  if (bruta === null || bruta === undefined || bruta === '') return null;
  const n = Number(bruta);
  return Number.isNaN(n) ? null : n;
};

/** Configuração do exame com os padrões preenchidos, ou null se não houver exame. */
const configDoExame = (exame) => {
  if (!exame || !exame.ativo) return null;
  return {
    mediaMinimaParaExame: exame.mediaMinimaParaExame ?? 4,
    notaFinalMinima: exame.notaFinalMinima ?? 5,
    pesoDaMedia: exame.pesoDaMedia ?? 0.5
  };
};
exports.configDoExame = configDoExame;

/**
 * Nota necessária em cada instrumento restante para chegar a `alvo`.
 *
 * Distribui igual, mas quem tem nota mínima acima da parte igual fica presa no
 * mínimo — e o resto é redistribuído entre os outros. Repete até estabilizar.
 */
const distribuirNecessaria = (restantes, falta) => {
  const presos = new Map(); // key -> nota fixada no mínimo
  for (;;) {
    const livres = restantes.filter((i) => !presos.has(i.key));
    const pesoPreso = restantes
      .filter((i) => presos.has(i.key))
      .reduce((s, i) => s + presos.get(i.key) * i.weight, 0);
    const pesoLivre = livres.reduce((s, i) => s + i.weight, 0);
    const igual = pesoLivre > 0 ? (falta - pesoPreso) / pesoLivre : 0;

    const novos = livres.filter((i) => i.notaMinima != null && i.notaMinima > igual);
    if (novos.length === 0) {
      const porInstrumento = new Map(
        restantes.map((i) => [i.key, presos.has(i.key) ? presos.get(i.key) : igual])
      );
      return { igual: livres.length > 0 ? igual : null, porInstrumento };
    }
    for (const i of novos) presos.set(i.key, i.notaMinima);
  }
};

exports.calculateGrade = (subject, gradesMap) => {
  const formula     = subject.gradeFormula;   // [{ key, label, weight, date, grupo, notaMinima }]
  const minimum     = subject.minimumGrade ?? 6.0;
  const grades      = gradesMap || {};        // objeto simples { P1: 7.5, AD: null }
  const exame       = configDoExame(subject.exame);

  let partialScore    = 0;  // soma(nota_i * peso_i) das notas preenchidas
  let partialWeight   = 0;  // soma dos pesos já avaliados
  let remainingWeight = 0;  // soma dos pesos ainda não avaliados

  const breakdown = formula.map(instrument => {
    const { key, label, weight, date } = instrument;
    const grupo      = instrument.grupo || null;
    const notaMinima = instrument.notaMinima ?? null;
    const grade      = lerNota(grades[key]);
    const filled     = grade !== null;

    if (filled) {
      partialScore  += grade * weight;
      partialWeight += weight;
    } else {
      remainingWeight += weight;
    }

    const abaixoDoMinimo = filled && notaMinima !== null && grade < notaMinima;
    return { key, label, weight, date, grupo, notaMinima, grade, filled, abaixoDoMinimo, notaNecessaria: null };
  });

  const allFilled = remainingWeight === 0;
  const abaixoDoMinimo = breakdown.some((i) => i.abaixoDoMinimo);

  // Média final (se tudo preenchido) ou parcial ponderada
  const currentAverage = allFilled
    ? partialScore
    : partialWeight > 0
      ? partialScore / partialWeight   // média só dos instrumentos avaliados (informativo)
      : null;

  // Nota necessária nos restantes, respeitando a nota mínima de cada um
  let neededGrade = null;
  let mathematicallyFailed = false;

  if (!allFilled) {
    const restantes = breakdown.filter((i) => !i.filled);
    const { igual, porInstrumento } = distribuirNecessaria(restantes, minimum - partialScore);
    const maiorExigida = Math.max(...porInstrumento.values());

    if (maiorExigida > 10) {
      mathematicallyFailed = true; // impossível passar mesmo com 10 em tudo
    } else {
      for (const i of restantes) i.notaNecessaria = Math.max(0, porInstrumento.get(i.key));
      neededGrade = igual === null ? Math.max(0, maiorExigida) : Math.max(0, igual);
    }
  }

  // Abaixo do mínimo de um instrumento e sem exame: não há nota que salve
  if (abaixoDoMinimo && !exame) {
    neededGrade = null;
    for (const i of breakdown) i.notaNecessaria = null;
  }

  // Projeção: se o aluno tirar a nota necessária em cada restante
  const projectedAverage = !allFilled && neededGrade !== null
    ? partialScore + breakdown.filter((i) => !i.filled).reduce((s, i) => s + i.notaNecessaria * i.weight, 0)
    : null;

  // Sem passar direto: quem ainda pode, vai para o exame
  const passaDireto = partialScore >= minimum && !abaixoDoMinimo;
  const melhorMediaPossivel = partialScore + 10 * remainingWeight;
  // Ainda faltam notas, mas passar direto já não dá: o caminho é o exame
  const rumoAoExame = Boolean(exame) && !allFilled && (mathematicallyFailed || abaixoDoMinimo) &&
    melhorMediaPossivel >= exame.mediaMinimaParaExame;

  let status;
  let resultadoDoExame = null;

  if (allFilled && passaDireto) {
    status = 'aprovado';
  } else if (exame && (mathematicallyFailed || abaixoDoMinimo || allFilled)) {
    if (melhorMediaPossivel < exame.mediaMinimaParaExame) {
      // Nem o exame alcança: com a média fechada é reprovação, antes disso é certa
      status = allFilled ? 'reprovado' : 'reprovado_matematicamente';
    } else if (!allFilled) {
      status = 'em_andamento'; // ainda não fechou a média; o exame é provável
    } else {
      const notaDoExame = lerNota(grades[CHAVE_DO_EXAME]);
      const pesoDoExame = 1 - exame.pesoDaMedia;
      const necessaria = (exame.notaFinalMinima - exame.pesoDaMedia * partialScore) / pesoDoExame;
      const mediaFinal = notaDoExame === null ? null : exame.pesoDaMedia * partialScore + pesoDoExame * notaDoExame;

      resultadoDoExame = {
        nota: notaDoExame,
        notaNecessaria: necessaria > 10 ? null : Math.max(0, necessaria),
        mediaFinal
      };

      if (mediaFinal !== null) status = mediaFinal >= exame.notaFinalMinima ? 'aprovado' : 'reprovado';
      else status = necessaria > 10 ? 'reprovado_matematicamente' : 'exame';
    }
  } else if (mathematicallyFailed || (abaixoDoMinimo && !exame)) {
    status = allFilled ? 'reprovado' : 'reprovado_matematicamente';
  } else if (allFilled) {
    status = 'reprovado';
  } else {
    status = 'em_andamento';
  }

  // Média de cada grupo, para quem usa média de médias
  const nomesDosGrupos = [...new Set(breakdown.map((i) => i.grupo).filter(Boolean))];
  const grupos = nomesDosGrupos.map((grupo) => {
    const itens = breakdown.filter((i) => i.grupo === grupo);
    const peso = itens.reduce((s, i) => s + i.weight, 0);
    const avaliados = itens.filter((i) => i.filled);
    const pesoAvaliado = avaliados.reduce((s, i) => s + i.weight, 0);
    return {
      grupo,
      peso,
      media: pesoAvaliado > 0 ? avaliados.reduce((s, i) => s + i.grade * i.weight, 0) / pesoAvaliado : null,
      completo: avaliados.length === itens.length
    };
  });

  return {
    breakdown,             // array com cada instrumento e sua nota
    grupos,                // média de cada grupo (vazio se a fórmula não usa grupos)
    partialScore,          // pontuação acumulada até agora
    partialWeight,         // peso já avaliado
    remainingWeight,       // peso ainda por avaliar
    currentAverage,        // média dos já avaliados (informativo)
    neededGrade,           // nota necessária nos restantes (parte igual)
    projectedAverage,      // média final projetada se atingir a nota necessária
    status,                // 'em_andamento' | 'aprovado' | 'reprovado' | 'reprovado_matematicamente' | 'exame'
    abaixoDoMinimo,        // alguma nota ficou abaixo da mínima do instrumento
    rumoAoExame,           // faltam notas, mas só o exame ainda aprova
    minimum,              // nota mínima para aprovação
    exame: exame ? { ...exame, ...(resultadoDoExame || { nota: null, notaNecessaria: null, mediaFinal: null }) } : null,
    allFilled
  };
};
