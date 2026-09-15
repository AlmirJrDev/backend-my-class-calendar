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
