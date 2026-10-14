/**
 * Importação do plano de ensino: valida o que o front leu do PDF e decide,
 * sem tocar no banco, o que vira criação, atualização ou nada.
 *
 * Fica separado do controller para ser testável. O controller só carrega os
 * dados, chama estas funções e grava o resultado.
 */

const TIPOS = ['exam', 'assignment', 'ativity'];

// Horário de início de cada período da grade.
const HORA_DO_PERIODO = { 1: '19:00', 2: '19:45', 3: '20:45', 4: '21:30', 5: '22:15' };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const normalizar = (texto) => String(texto ?? '').trim().toLocaleUpperCase('pt-BR');

/** T03:00Z é meia-noite em Brasília; gravar T00:00Z mostraria o dia anterior. */
const paraData = (iso) => new Date(`${iso}T03:00:00.000Z`);

const isoDe = (data) => new Date(data).toISOString().slice(0, 10);

const dataValida = (iso) =>
  ISO.test(iso) && !Number.isNaN(new Date(`${iso}T12:00:00.000Z`).getTime());

/**
 * Confere o corpo recebido e devolve só o que interessa, já normalizado.
 * Nunca confia no formato: quem chama é o navegador.
 */
function validarPlano(corpo = {}) {
  const erros = [];

  const formula = Array.isArray(corpo.gradeFormula) ? corpo.gradeFormula : [];
  if (formula.length === 0) erros.push('O plano não traz a fórmula de média.');

  const chaves = new Set();
  const gradeFormula = [];
  for (const item of formula) {
    const key = normalizar(item?.key);
    const peso = Number(item?.weight);
    if (!key) {
      erros.push('Há um item da fórmula sem nome.');
      continue;
    }
    if (chaves.has(key)) erros.push(`O item ${key} aparece duas vezes na fórmula.`);
    chaves.add(key);
    if (!(peso >= 0 && peso <= 1)) {
      erros.push(`O peso de ${key} precisa estar entre 0 e 1.`);
      continue;
    }
    if (item.date !== undefined && item.date !== null && item.date !== '' && !dataValida(item.date)) {
      erros.push(`A data de ${key} é inválida.`);
      continue;
    }
    gradeFormula.push({
      key,
      label: String(item.label || key).trim(),
      weight: peso,
      date: item.date || undefined,
    });
  }

  // A média do app soma os pesos direto contra a nota mínima: se não fechar 1,0
  // a conta sai errada para a turma inteira.
  const soma = gradeFormula.reduce((a, i) => a + i.weight, 0);
  if (gradeFormula.length > 0 && Math.abs(soma - 1) > 1e-6) {
    erros.push(`Os pesos da fórmula somam ${Math.round(soma * 1000) / 1000}, e deveriam somar 1.`);
  }

  const eventos = [];
  for (const e of Array.isArray(corpo.eventos) ? corpo.eventos : []) {
    const title = String(e?.title ?? '').trim();
    if (!title) {
      erros.push('Há uma avaliação sem título.');
      continue;
    }
    if (!dataValida(e.date)) {
      erros.push(`A data de "${title}" é inválida.`);
      continue;
    }
    if (!TIPOS.includes(e.type)) {
      erros.push(`O tipo de "${title}" é inválido.`);
      continue;
    }
    const key = e.key ? normalizar(e.key) : undefined;
    if (key && !chaves.has(key)) {
      erros.push(`"${title}" aponta para ${key}, que não está na fórmula.`);
      continue;
    }
    eventos.push({
      title,
      type: e.type,
      date: e.date,
      key,
      description: e.description ? String(e.description).trim() : undefined,
      // Prova de todas as matérias (a interdisciplinar): existe um evento só
      // por turma, então não se cria um por matéria.
      compartilhado: Boolean(e.compartilhado),
    });
  }

  const nota = Number(corpo.minimumGrade);

  return {
    erros,
    plano: {
      code: corpo.code ? String(corpo.code).trim() : undefined,
      teacher: corpo.teacher ? String(corpo.teacher).trim() : undefined,
      minimumGrade: nota >= 0 && nota <= 10 ? nota : undefined,
      gradeFormula,
      eventos,
    },
  };
}

/** Primeiro período da matéria no dia da data, como horário; vazio se não há aula. */
function horarioDaAula(materia, iso) {
  const dia = new Date(`${iso}T12:00:00.000Z`).getUTCDay();
  const naGrade = (materia.schedule || []).find((s) => s.dayOfWeek === dia);
  if (!naGrade || !naGrade.periods?.length) return undefined;
  return HORA_DO_PERIODO[Math.min(...naGrade.periods)];
}

/**
 * Para cada avaliação do plano, acha o evento que já existe ou manda criar.
 *
 * Procura nesta ordem, sem reaproveitar o mesmo evento duas vezes:
 *   1. o item da fórmula (gradeKey) — evento já ligado à nota;
 *   2. mesmo título e mesma data;
 *   3. mesma data, sem ligação com a nota e do tipo prova. É o caso do evento
 *      que entrou "Prova" por anúncio em aula antes de o plano sair: vira o
 *      item certo em vez de duplicar.
 *
 * `existentes` são os eventos da matéria; `compartilhados`, os da turma sem
 * matéria (a prova interdisciplinar).
 */
function planejarEventos(plano, materia, existentes = [], compartilhados = []) {
  const usados = new Set();
  const livre = (e) => !usados.has(String(e._id));
  const marca = (e) => {
    if (e) usados.add(String(e._id));
    return e;
  };

  return plano.eventos.map((previsto) => {
    if (previsto.compartilhado) {
      const jaTem = compartilhados.find((e) => isoDe(e.date) === previsto.date);
      return jaTem
        ? { acao: 'manter', evento: previsto, existenteId: String(jaTem._id), motivo: 'já está no calendário da turma' }
        : { acao: 'criar', evento: { ...previsto, semMateria: true } };
    }

    const naData = existentes.filter((e) => livre(e) && isoDe(e.date) === previsto.date);

    const achado = marca(
      (previsto.key && existentes.find((e) => livre(e) && normalizar(e.gradeKey) === previsto.key)) ||
        naData.find((e) => normalizar(e.title) === normalizar(previsto.title)) ||
        naData.find((e) => !e.gradeKey && e.type === 'exam')
    );

    const time = horarioDaAula(materia, previsto.date);

    if (!achado) {
      return { acao: 'criar', evento: { ...previsto, time } };
    }

    const novo = { ...previsto, time: achado.time || time };
    const igual =
      achado.title === novo.title &&
      achado.type === novo.type &&
      isoDe(achado.date) === novo.date &&
      normalizar(achado.gradeKey) === normalizar(novo.key) &&
      String(achado.subjectId || '') === String(materia._id);

    return {
      acao: igual ? 'manter' : 'atualizar',
      evento: novo,
      existenteId: String(achado._id),
      tituloAntes: achado.title !== novo.title ? achado.title : undefined,
    };
  });
}

/** O que muda na matéria, campo a campo, para a prévia mostrar antes/depois. */
function mudancasDaMateria(plano, materia) {
  const mudancas = [];
  const comparar = (campo, rotulo, antes, depois) => {
    if (depois !== undefined && String(antes ?? '') !== String(depois)) {
      mudancas.push({ campo, rotulo, antes: antes ?? '', depois });
    }
  };
  comparar('code', 'Código', materia.code, plano.code);
  comparar('teacher', 'Professor', materia.teacher, plano.teacher);
  comparar('minimumGrade', 'Média mínima', materia.minimumGrade, plano.minimumGrade);
  return mudancas;
}

/** Os campos da matéria que o plano grava. */
function camposDaMateria(plano) {
  const campos = {
    gradeFormula: plano.gradeFormula.map((i) => ({
      key: i.key,
      label: i.label,
      weight: i.weight,
      date: i.date ? paraData(i.date) : undefined,
    })),
  };
  if (plano.code) campos.code = plano.code;
  if (plano.teacher) campos.teacher = plano.teacher;
  if (plano.minimumGrade !== undefined) campos.minimumGrade = plano.minimumGrade;
  return campos;
}

/** Os campos de um evento a gravar, no formato do model. */
function camposDoEventoDoPlano(acao, materia) {
  const e = acao.evento;
  const campos = {
    title: e.title,
    type: e.type,
    date: paraData(e.date),
    time: e.time,
    description: e.description || `${materia.name} — conforme plano de ensino.`,
    recurring: false,
  };
  if (!e.semMateria) {
    campos.subject = materia.name;
    campos.subjectId = materia._id;
    campos.gradeKey = e.key;
  }
  return campos;
}

module.exports = {
  validarPlano,
  planejarEventos,
  mudancasDaMateria,
  camposDaMateria,
  camposDoEventoDoPlano,
  horarioDaAula,
  paraData,
};
