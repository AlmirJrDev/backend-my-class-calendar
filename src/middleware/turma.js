const TurmaMember = require('../models/turmaMember');

/**
 * Resolve de quais turmas a pessoa participa e com qual papel em cada uma,
 * deixando isso pronto em `req.turmaIds` e `req.papelNaTurma`. Toda leitura de
 * matéria e evento filtra por esse conjunto — é a fronteira que impede uma
 * turma de enxergar a outra.
 *
 * O cliente pode escolher uma turma ativa com `?turmaId=`. O vínculo é sempre
 * conferido: pedir uma turma de que não se participa devolve 403, e não uma
 * lista vazia, para o erro não passar por "não tem nada aqui".
 *
 * Sem o parâmetro, valem todas as turmas da pessoa. É o que mantém o app
 * funcionando enquanto o seletor de turma não existe na interface.
 */
exports.escopoDeTurma = async (req, res, next) => {
  try {
    const vinculos = await TurmaMember.find({ userId: req.user.id })
      .select('turmaId role')
      .lean();

    req.papelNaTurma = new Map(
      vinculos.map((v) => [v.turmaId.toString(), v.role])
    );

    const todas = vinculos.map((v) => v.turmaId);
    const pedida = req.query.turmaId || req.body?.turmaId;

    if (pedida) {
      if (!req.papelNaTurma.has(pedida.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Você não participa desta turma'
        });
      }
      req.turmaIds = todas.filter((id) => id.toString() === pedida.toString());
    } else {
      req.turmaIds = todas;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao resolver a turma',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

/**
 * Exige que a pessoa seja representante da turma em questão. Substitui o antigo
 * adminOnly: quem administra deixou de ser um papel global e passou a ser um
 * papel dentro de cada turma.
 *
 * O superadmin passa por aqui para poder dar suporte — mas isso vale só para a
 * estrutura da turma. Nota e falta continuam sendo do aluno, e nenhuma rota as
 * expõe a terceiros.
 */
exports.exigeRepresentante = (req, res, next) => {
  if (req.user.role === 'superadmin') return next();

  const ehRepresentante = (req.turmaIds || []).some(
    (id) => req.papelNaTurma.get(id.toString()) === 'representante'
  );

  if (!ehRepresentante) {
    return res.status(403).json({
      success: false,
      error: 'Apenas o representante da turma pode fazer isso'
    });
  }

  next();
};

/**
 * Filtro base das leituras. Quem não está em turma nenhuma não vê nada — o
 * `$in: []` do Mongo não casa com documento algum, que é o que queremos.
 */
exports.filtroDeTurma = (req) => ({ turmaId: { $in: req.turmaIds || [] } });

/** Diz se o documento pertence a alguma turma da pessoa. */
exports.pertenceAoUsuario = (req, doc) =>
  Boolean(doc.turmaId) &&
  (req.turmaIds || []).some((id) => id.toString() === doc.turmaId.toString());
