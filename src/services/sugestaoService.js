/**
 * Regras de acesso e conversão das sugestões, puras para serem testáveis sem
 * banco. O controller só carrega os dados e aplica o que estas funções decidem.
 *
 * Toda sugestão pertence a uma turma, e quem modera é o representante DAQUELA
 * turma. Ser representante de outra turma não dá acesso: antes desta regra, as
 * rotas de moderação listavam e aprovavam sugestões de todas as turmas.
 */
const { gerenciaTurma } = require('./eventoService');

// A sugestão usa nomes em português; o evento, o enum do model Event.
const TIPO_DO_EVENTO = {
  prova: 'exam',
  trabalho: 'assignment',
  aula: 'class',
  atividade: 'ativity',
  evento: 'ativity',
  outro: 'ativity'
};

/**
 * As turmas em que a pessoa modera, dentre as do escopo da requisição. O
 * superadmin entra como suporte, mas só nas turmas em que participa: não há
 * visão global.
 */
exports.turmasQueModera = (req) => {
  const doEscopo = req.turmaIds || [];
  if (req.user?.role === 'superadmin') return doEscopo;
  return doEscopo.filter((id) => req.papelNaTurma?.get(id.toString()) === 'representante');
};

/** Pode aprovar, rejeitar ou ver qualquer sugestão desta turma? */
exports.podeModerar = (req, sugestao) =>
  Boolean(sugestao?.turmaId) && gerenciaTurma(req, sugestao.turmaId);

const idDoAutor = (sugestao) => String(sugestao.userId?._id ?? sugestao.userId);

/** O autor vê e apaga a própria; o representante da turma, qualquer uma dela. */
exports.podeVer = (req, sugestao) =>
  idDoAutor(sugestao) === String(req.user?.id) || exports.podeModerar(req, sugestao);

/**
 * Valida o pedido de criação e diz em que turma a sugestão nasce. Devolve
 * { turmaId } ou { erro }. Sem uma turma só no escopo não há como saber onde
 * aprovar depois, então não cria.
 */
exports.turmaDaNovaSugestao = (req) => {
  const turmas = req.turmaIds || [];
  if (turmas.length === 0) {
    return { erro: 'Você precisa participar de uma turma para sugerir' };
  }
  if (turmas.length > 1) {
    return { erro: 'Escolha a turma antes de enviar a sugestão' };
  }
  // Representante cria o evento direto: sugerir a si mesmo só gera um passo a
  // mais para aprovar.
  if (gerenciaTurma(req, turmas[0])) {
    return { erro: 'Você é representante desta turma: adicione o evento direto no calendário' };
  }
  return { turmaId: turmas[0] };
};

/**
 * Converte os dados da sugestão em campos de evento. Só o que o evento aceita:
 * `priority` não existe no evento, e `completed` nunca vem de sugestão. O tipo
 * é traduzido — "atividade" não é um valor válido do model Event, e passar o
 * dado cru fazia a aprovação falhar na validação.
 */
exports.camposDoEventoDaSugestao = (dados = {}) => {
  const campos = {};
  for (const campo of ['title', 'description', 'date', 'time', 'subject', 'location']) {
    if (dados[campo] !== undefined && dados[campo] !== null) campos[campo] = dados[campo];
  }
  if (dados.type !== undefined && dados.type !== null) {
    campos.type = TIPO_DO_EVENTO[dados.type] || dados.type;
  }
  return campos;
};

/**
 * "Minhas sugestões" da turma aberta. Sem o filtro de turma, quem participa de
 * mais de uma via as sugestões de todas misturadas, qualquer que fosse a ativa.
 */
exports.filtroDasMinhas = (req) => ({
  userId: req.user.id,
  turmaId: { $in: req.turmaIds || [] }
});

exports.TIPO_DO_EVENTO = TIPO_DO_EVENTO;
