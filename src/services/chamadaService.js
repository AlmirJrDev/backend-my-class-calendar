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

/** Minuto do dia de uma data, no fuso de quem enviou. */
exports.minutoDoDia = (data) => data.getHours() * 60 + data.getMinutes();
