/**
 * Exclusão definitiva de uma turma e de tudo o que é dela.
 *
 * As regras e a rotina recebem os models por parâmetro: assim o teste confere
 * o que é apagado, em que ordem e com que filtro, sem precisar de banco.
 */

/** Só quem criou a turma exclui. Ela pode ter vários representantes. */
exports.podeExcluir = (turma, userId) =>
  Boolean(turma && userId) && String(turma.ownerId) === String(userId);

/**
 * Compara o nome digitado com o da turma. Ignora caixa, espaços repetidos e o
 * tipo de traço: ninguém digita o travessão de "SI — noturno" no teclado.
 */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFC')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');

exports.confereNome = (digitado, nome) => {
  const esperado = normalizar(nome);
  return Boolean(esperado) && normalizar(digitado) === esperado;
};

/**
 * Filtros de tudo o que pertence à turma. Presença e nota não guardam a
 * turma, só a matéria; observação e material têm turmaId, mas os antigos
 * podem ter só o evento ou a matéria, então o filtro cobre os dois.
 */
function filtros(turmaId, materias, eventos) {
  const daMateria = { subjectId: { $in: materias } };
  return {
    presencas: daMateria,
    notas: daMateria,
    observacoes: { $or: [{ turmaId }, { eventId: { $in: eventos } }] },
    materiais: { $or: [{ turmaId }, { subjectId: { $in: materias } }, { eventId: { $in: eventos } }] },
    chamadas: { $or: [{ turmaId }, { subjectId: { $in: materias } }] },
    sugestoes: { turmaId },
    eventos: { turmaId },
    materias: { turmaId },
    membros: { turmaId }
  };
}

// Model de cada parte, na ordem em que sai: primeiro o que depende das
// matérias e dos eventos, por último os vínculos e a turma. Se algo falhar no
// meio, a turma continua lá e excluir de novo termina o serviço.
const ORDEM = [
  ['presencas', 'Attendance'],
  ['notas', 'GradeEntry'],
  ['observacoes', 'EventNote'],
  ['materiais', 'Material'],
  ['chamadas', 'Chamada'],
  ['sugestoes', 'EventSuggestion'],
  ['eventos', 'Event'],
  ['materias', 'Subject'],
  ['membros', 'TurmaMember']
];

async function idsDaTurma(turmaId, models) {
  const [materias, eventos] = await Promise.all([
    models.Subject.find({ turmaId }).distinct('_id'),
    models.Event.find({ turmaId }).distinct('_id')
  ]);
  return { materias, eventos };
}

/** Quanto de cada coisa sai junto com a turma, para a pessoa ver antes de confirmar. */
exports.contarDaTurma = async (turmaId, models) => {
  const { materias, eventos } = await idsDaTurma(turmaId, models);
  const f = filtros(turmaId, materias, eventos);
  const contagens = await Promise.all(ORDEM.map(([parte, model]) => models[model].countDocuments(f[parte])));
  return Object.fromEntries(ORDEM.map(([parte], i) => [parte, contagens[i]]));
};

/** Apaga a turma e tudo o que é dela. Devolve quanto saiu de cada parte. */
exports.excluirTurma = async (turmaId, models) => {
  const { materias, eventos } = await idsDaTurma(turmaId, models);
  const f = filtros(turmaId, materias, eventos);

  const apagados = {};
  for (const [parte, model] of ORDEM) {
    const r = await models[model].deleteMany(f[parte]);
    apagados[parte] = r.deletedCount ?? 0;
  }
  await models.Turma.deleteOne({ _id: turmaId });
  return apagados;
};

exports.ORDEM = ORDEM;
