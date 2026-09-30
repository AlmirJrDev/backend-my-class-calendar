/** Quantos avisos bastam para arriscar um palpite de horário. */
const MINIMO_DE_AMOSTRAS = 2;

/** Quantos avisos recentes entram na conta. */
const JANELA = 8;

/**
 * Horário típico da chamada, em minutos desde a meia-noite. Usa a mediana dos
 * avisos mais recentes: um dia em que alguém avisou atrasado desloca a média,
 * mas não a mediana.
 *
 * Recebe os minutos já ordenados do mais recente para o mais antigo, como o
 * banco devolve. Devolve null enquanto não houver sinal suficiente — é melhor
 * não dizer nada do que chutar a hora da chamada.
 */
exports.horarioTipico = (minutosRecentes = []) => {
  const amostra = minutosRecentes.slice(0, JANELA);
  if (amostra.length < MINIMO_DE_AMOSTRAS) return null;

  const ordenados = [...amostra].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);

  const mediana =
    ordenados.length % 2 === 1
      ? ordenados[meio]
      : Math.round((ordenados[meio - 1] + ordenados[meio]) / 2);

  return { minutoDoDia: mediana, amostras: amostra.length };
};

/**
 * Quem avisou desfaz o próprio aviso; o representante desfaz qualquer um —
 * um toque errado entra na conta do horário típico e precisa sair de lá.
 */
exports.podeDesfazer = (req, chamada, ehRepresentante) =>
  String(chamada.userId) === String(req.user?.id) || Boolean(ehRepresentante);

/** "19:22" a partir dos minutos desde a meia-noite. */
exports.comoHora = (minutoDoDia) =>
  `${String(Math.floor(minutoDoDia / 60)).padStart(2, '0')}:${String(minutoDoDia % 60).padStart(2, '0')}`;

/** Brasília está em UTC−3 o ano todo desde que o horário de verão acabou. */
const FUSO_EM_MINUTOS = -3 * 60;

/**
 * O dia e o minuto do dia de um instante, no horário de Brasília. Não dá para
 * usar getHours(): o servidor roda em UTC, e 21:27 aqui viraria 00:27 — e o
 * aviso das 21h cairia no dia seguinte. O dia sai à meia-noite de Brasília
 * (03:00 UTC), como as datas dos eventos.
 */
exports.momentoEmBrasilia = (instante) => {
  const local = new Date(instante.getTime() + FUSO_EM_MINUTOS * 60 * 1000);
  return {
    dia: new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - FUSO_EM_MINUTOS * 60 * 1000
    ),
    minutoDoDia: local.getUTCHours() * 60 + local.getUTCMinutes()
  };
};
