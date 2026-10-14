/**
 * Direitos do titular (LGPD, art. 18) sobre a própria conta: aceite dos termos,
 * acesso e portabilidade dos dados, e exclusão da conta.
 *
 * Recebe os models por parâmetro para o teste conferir o que é lido e apagado
 * sem precisar de banco.
 */

/**
 * Versão vigente dos Termos de Uso e da Política de Privacidade. Mudou o texto
 * de forma relevante? Troque a data: todo mundo é chamado a aceitar de novo.
 */
// .2: entrou o login com Google (novo fornecedor e novos dados recebidos).
exports.VERSAO_DOS_TERMOS = '2026-10-14.2';

/** A pessoa precisa aceitar a versão atual? */
exports.termosPendentes = (usuario) => usuario?.termosAceitos?.versao !== exports.VERSAO_DOS_TERMOS;

exports.registroDeAceite = (agora = new Date()) => ({ versao: exports.VERSAO_DOS_TERMOS, em: agora });

/** Confirmação da exclusão: o e-mail da própria conta, sem diferença de caixa ou espaço. */
exports.confereEmail = (digitado, email) =>
  Boolean(email) && String(digitado ?? '').trim().toLowerCase() === String(email).trim().toLowerCase();

// Campos internos que não são "dados da pessoa": segredos de login e controle.
const SEGREDOS = '-verificationToken -verificationOtp -verificationTokenExpire -otpAttempts -calendarToken -__v';

/**
 * Tudo o que é da pessoa e sai com a conta. Conteúdo que ela criou como
 * representante (matérias, eventos) é da turma e fica com a turma.
 */
const DA_PESSOA = [
  ['presencas', 'Attendance'],
  ['notas', 'GradeEntry'],
  ['sugestoes', 'EventSuggestion'],
  ['observacoes', 'EventNote'],
  ['materiais', 'Material'],
  ['avisosDeChamada', 'Chamada'],
  ['turmas', 'TurmaMember']
];
exports.DA_PESSOA = DA_PESSOA;

/** Turmas que a pessoa criou: excluir a conta as deixaria sem dono. */
exports.turmasQueImpedem = async (userId, models) =>
  models.Turma.find({ ownerId: userId }).select('name').lean();

/** Os dados da pessoa, como estão guardados, para baixar (acesso e portabilidade). */
exports.exportarDados = async (userId, models, agora = new Date()) => {
  const perfil = await models.User.findById(userId).select(SEGREDOS).lean();
  const partes = await Promise.all(
    DA_PESSOA.map(([, model]) => models[model].find({ userId }).select('-__v').lean())
  );
  return {
    geradoEm: agora.toISOString(),
    versaoDosTermos: exports.VERSAO_DOS_TERMOS,
    perfil,
    ...Object.fromEntries(DA_PESSOA.map(([parte], i) => [parte, partes[i]]))
  };
};

/**
 * Apaga a conta e os dados pessoais. Os vínculos com turmas saem antes do
 * usuário: se algo falhar no meio, a conta continua lá e dá para tentar de novo.
 */
exports.excluirConta = async (userId, models) => {
  const apagados = {};
  for (const [parte, model] of DA_PESSOA) {
    const r = await models[model].deleteMany({ userId });
    apagados[parte] = r.deletedCount ?? 0;
  }
  await models.User.deleteOne({ _id: userId });
  return apagados;
};
