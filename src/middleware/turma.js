const TurmaMember = require('../models/turmaMember');

/**
 * Resolve de quais turmas a pessoa participa e deixa isso pronto em
 * `req.turmaIds`. Toda leitura de matéria e evento filtra por esse conjunto —
 * é a fronteira que impede uma turma de enxergar a outra.
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
    const doUsuario = await TurmaMember.turmaIdsDoUsuario(req.user.id);

    const pedida = req.query.turmaId;
    if (pedida) {
      const participa = doUsuario.some((id) => id.toString() === pedida);
      if (!participa) {
        return res.status(403).json({
          success: false,
          error: 'Você não participa desta turma'
        });
      }
      req.turmaIds = doUsuario.filter((id) => id.toString() === pedida);
    } else {
      req.turmaIds = doUsuario;
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
 * Filtro base das leituras. Quem não está em turma nenhuma não vê nada — o
 * `$in: []` do Mongo não casa com documento algum, que é o que queremos.
 */
exports.filtroDeTurma = (req) => ({ turmaId: { $in: req.turmaIds || [] } });

/** Diz se o documento pertence a alguma turma da pessoa. */
exports.pertenceAoUsuario = (req, doc) =>
  Boolean(doc.turmaId) &&
  (req.turmaIds || []).some((id) => id.toString() === doc.turmaId.toString());
