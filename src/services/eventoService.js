/**
 * Regras de escrita de eventos, puras para serem testáveis sem banco.
 */

// Só o que o formulário edita. turmaId, userId e completed nunca vêm do corpo:
// aceitar o corpo inteiro deixava mover um evento para outra turma.
const CAMPOS_EDITAVEIS = [
  'title',
  'type',
  'date',
  'time',
  'endTime',
  'location',
  'subject',
  'subjectId',
  'gradeKey',
  'adiado',
  'description',
  'recurring',
  'daysOfWeek'
];

exports.camposDoEvento = (corpo = {}) =>
  Object.fromEntries(
    CAMPOS_EDITAVEIS.filter((campo) => corpo[campo] !== undefined).map((campo) => [
      campo,
      corpo[campo]
    ])
  );

/**
 * Pode criar ou mexer em eventos desta turma? Precisa ser representante nela —
 * ser representante de outra turma não basta. O superadmin passa para dar
 * suporte.
 */
exports.gerenciaTurma = (req, turmaId) => {
  if (req.user?.role === 'superadmin') return true;
  if (!turmaId || !req.papelNaTurma) return false;
  return req.papelNaTurma.get(turmaId.toString()) === 'representante';
};

/** Quem escreveu a observação apaga a própria; o representante apaga qualquer uma. */
exports.podeApagarNota = (req, nota) =>
  String(nota.userId?._id ?? nota.userId) === String(req.user?.id) ||
  exports.gerenciaTurma(req, nota.turmaId);

const diaDe = (data) => new Date(data).toISOString().slice(0, 10);

/**
 * Marcas que a edição de um evento acrescenta conforme a data muda:
 * - mudou o dia: a data passa a ser da turma (o plano não a sobrescreve) e,
 *   se o pedido não disse o contrário, o evento deixa de estar adiado — ter
 *   uma data nova é justamente o fim do adiamento;
 * - adiou: também é uma decisão da turma sobre a data.
 */
exports.marcasDeData = (evento, corpo = {}) => {
  const marcas = {};
  const novaData = corpo.date !== undefined ? new Date(corpo.date) : null;
  const mudouDia = novaData && !Number.isNaN(novaData.getTime()) && diaDe(novaData) !== diaDe(evento.date);

  if (mudouDia) {
    marcas.dataAlteradaNaTurma = true;
    if (corpo.adiado === undefined) marcas.adiado = false;
  }
  if (corpo.adiado === true) marcas.dataAlteradaNaTurma = true;
  return marcas;
};
