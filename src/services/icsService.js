/**
 * Gera o calendário no formato iCalendar (RFC 5545), o que o Google Agenda, o
 * Calendário do iPhone e o Outlook assinam. Função pura: recebe eventos já
 * buscados e devolve o texto, para ser testável sem banco.
 */

const FUSO = 'America/Sao_Paulo';

const TIPOS = {
  exam: 'Prova',
  assignment: 'Entrega',
  class: 'Aula',
  ativity: 'Atividade'
};

// Lembrete sugerido por tipo. O Calendário do iPhone respeita; o Google Agenda
// ignora alarmes de agenda assinada e usa os avisos padrão que a pessoa
// escolher para ela.
const LEMBRETES = {
  exam: '-P1D',
  assignment: '-P1D',
  class: '-PT30M',
  ativity: '-PT1H'
};

const DIAS_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Escapa texto: barra, ponto e vírgula, vírgula e quebra de linha. */
const escapar = (texto = '') =>
  String(texto)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/**
 * Quebra linhas acima de 75 bytes, como a especificação exige. Conta bytes em
 * UTF-8 e nunca parte um caractere acentuado ao meio.
 */
function dobrar(linha) {
  const partes = [];
  let atual = '';
  let bytes = 0;
  for (const caractere of linha) {
    const tamanho = Buffer.byteLength(caractere, 'utf8');
    const limite = partes.length === 0 ? 75 : 74; // continuação ganha um espaço
    if (bytes + tamanho > limite) {
      partes.push(atual);
      atual = '';
      bytes = 0;
    }
    atual += caractere;
    bytes += tamanho;
  }
  partes.push(atual);
  return partes.join('\r\n ');
}

const dois = (n) => String(n).padStart(2, '0');

/**
 * Dia do evento no horário de Brasília. As datas são gravadas à meia-noite de
 * Brasília (03:00 UTC), então somar -3h e ler em UTC dá o dia certo em qualquer
 * servidor, inclusive na Vercel, que roda em UTC.
 */
function diaEmBrasilia(data) {
  const d = new Date(new Date(data).getTime() - 3 * 60 * 60 * 1000);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

const comoData = ({ ano, mes, dia }) => `${ano}${dois(mes)}${dois(dia)}`;

function diaSeguinte({ ano, mes, dia }) {
  const d = new Date(Date.UTC(ano, mes - 1, dia + 1));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

/** "20:45" → "204500" */
const comoHora = (hhmm) => hhmm.replace(':', '') + '00';

/** Uma hora depois de "HH:mm", sem passar da meia-noite. */
function umaHoraDepois(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${dois(Math.min(h + 1, 23))}:${dois(h + 1 > 23 ? 59 : m)}`;
}

/** Carimbo em UTC, o formato de DTSTAMP. */
const carimbo = (data) => new Date(data).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;

function linhasDoEvento(evento, { prefixo, linkDoApp }) {
  const tipo = TIPOS[evento.type] || 'Evento';
  const dia = diaEmBrasilia(evento.date);
  const temHora = HORA_VALIDA.test(evento.time || '');

  // A turma vai no fim: o calendário corta o título no fim, e o que importa
  // de relance é o tipo e o nome da prova.
  const titulo = [`${tipo}: ${evento.title}`, prefixo].filter(Boolean).join(' · ');
  const descricao = [
    evento.subject && `Matéria: ${evento.subject}`,
    evento.description,
    linkDoApp && `Abrir no app: ${linkDoApp}`
  ]
    .filter(Boolean)
    .join('\n\n');

  const linhas = [
    'BEGIN:VEVENT',
    `UID:${evento._id}@myclasscalendar`,
    `DTSTAMP:${carimbo(evento.updatedAt || evento.createdAt || new Date())}`
  ];

  if (temHora) {
    const fim = HORA_VALIDA.test(evento.endTime || '') && evento.endTime > evento.time
      ? evento.endTime
      : umaHoraDepois(evento.time);
    linhas.push(`DTSTART;TZID=${FUSO}:${comoData(dia)}T${comoHora(evento.time)}`);
    linhas.push(`DTEND;TZID=${FUSO}:${comoData(dia)}T${comoHora(fim)}`);
  } else {
    // Sem horário vira evento de dia inteiro: o fim é exclusivo, então é o
    // dia seguinte.
    linhas.push(`DTSTART;VALUE=DATE:${comoData(dia)}`);
    linhas.push(`DTEND;VALUE=DATE:${comoData(diaSeguinte(dia))}`);
  }

  if (evento.recurring && Array.isArray(evento.daysOfWeek) && evento.daysOfWeek.length > 0) {
    const dias = evento.daysOfWeek.map((d) => DIAS_ICS[d]).filter(Boolean).join(',');
    // Sem fim, a aula se repetiria para sempre; seis meses cobre um semestre.
    const ate = new Date(Date.UTC(dia.ano, dia.mes - 1 + 6, dia.dia));
    linhas.push(`RRULE:FREQ=WEEKLY;BYDAY=${dias};UNTIL=${comoData({ ano: ate.getUTCFullYear(), mes: ate.getUTCMonth() + 1, dia: ate.getUTCDate() })}T235959Z`);
  }

  linhas.push(`SUMMARY:${escapar(titulo)}`);
  if (evento.location) linhas.push(`LOCATION:${escapar(evento.location)}`);
  if (descricao) linhas.push(`DESCRIPTION:${escapar(descricao)}`);
  if (linkDoApp) linhas.push(`URL:${linkDoApp}`);
  linhas.push(`CATEGORIES:${escapar(tipo)}`);

  const lembrete = LEMBRETES[evento.type];
  if (lembrete) {
    linhas.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapar(titulo)}`,
      `TRIGGER:${lembrete}`,
      'END:VALARM'
    );
  }

  linhas.push('END:VEVENT');
  return linhas;
}

/**
 * @param {object[]} eventos  eventos das turmas, cada um com `turmaNome` se a
 *                            pessoa estiver em mais de uma turma
 * @param {object}   opcoes   { nome, linkDoApp }
 */
exports.gerarCalendario = (eventos, { nome = 'My Class Calendar', linkDoApp } = {}) => {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//My Class Calendar//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapar(nome)}`,
    `X-WR-TIMEZONE:${FUSO}`,
    // Pede para o cliente buscar de novo a cada hora. O Google decide o
    // próprio ritmo e costuma levar mais tempo.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    // Brasil sem horário de verão desde 2019: um fuso fixo em -03.
    'BEGIN:VTIMEZONE',
    `TZID:${FUSO}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'TZNAME:-03',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  for (const evento of eventos) {
    linhas.push(...linhasDoEvento(evento, { prefixo: evento.turmaNome, linkDoApp }));
  }

  linhas.push('END:VCALENDAR');
  // CRLF é o que a especificação pede; alguns clientes recusam só \n.
  return linhas.map(dobrar).join('\r\n') + '\r\n';
};

exports._internos = { escapar, dobrar, diaEmBrasilia };
