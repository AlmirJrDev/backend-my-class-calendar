/**
 * Cria os eventos das avaliações de 2026/2 a partir dos planos de ensino.
 *
 *   node scripts/seed-avaliacoes-2026-2.js            # mostra o que faria
 *   node scripts/seed-avaliacoes-2026-2.js --apply    # grava
 *
 * Idempotente: identifica o evento por título + data + dono.
 *
 * Datas gravadas como T03:00:00Z, que é meia-noite em Brasília (UTC-3). É a
 * convenção dos eventos que já existiam; gravar T00:00Z faria o evento
 * aparecer no dia anterior no calendário.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Event = require('../src/models/event');
const Subject = require('../src/models/subject');
const User = require('../src/models/user');

const APLICAR = process.argv.includes('--apply');

// Horário de início de cada período.
const HORA_DO_PERIODO = { 1: '19:00', 2: '19:45', 3: '20:45', 4: '21:30', 5: '22:15' };
const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// type: 'exam' para provas, 'assignment' para trabalhos entregues.
const AVALIACOES = [
  // --- Estrutura de Dados II ---
  { subject: 'Estrutura de Dados II', date: '2026-09-28', type: 'exam', title: 'P1 — Prova 1' },
  { subject: 'Estrutura de Dados II', date: '2026-11-30', type: 'exam', title: 'P2 — Prova 2' },

  // --- Probabilidade e Estatística ---
  { subject: 'Probabilidade e Estatística', date: '2026-09-22', type: 'exam', title: 'P1 — Prova 1' },
  { subject: 'Probabilidade e Estatística', date: '2026-09-29', type: 'assignment', title: 'GR — Trabalho de Gráficos' },
  { subject: 'Probabilidade e Estatística', date: '2026-12-01', type: 'exam', title: 'P2 — Prova 2' },
  { subject: 'Probabilidade e Estatística', date: '2026-12-03', type: 'assignment', title: 'PRO — Projeto Integrador' },
  { subject: 'Probabilidade e Estatística', date: '2026-12-08', type: 'exam', title: 'SUB1 — Substitutiva da P1' },
  { subject: 'Probabilidade e Estatística', date: '2026-12-08', type: 'exam', title: 'SUB2 — Substitutiva da P2' },

  // --- Engenharia de Software ---
  { subject: 'Engenharia de Software', date: '2026-09-30', type: 'exam', title: 'PR1 — Primeira Avaliação Teórica' },
  { subject: 'Engenharia de Software', date: '2026-10-21', type: 'assignment', title: 'TRB — Trabalho em grupo' },
  { subject: 'Engenharia de Software', date: '2026-11-24', type: 'assignment', title: 'PGI — Projeto Integrador' },
  { subject: 'Engenharia de Software', date: '2026-12-02', type: 'exam', title: 'PR2 — Segunda Avaliação Teórica' },

  // --- Fundamentos do Cristianismo ---
  { subject: 'Fundamentos do Cristianismo', date: '2026-08-25', type: 'assignment', title: 'ATV — Estudos de Caso e Pequenos Grupos' },
  { subject: 'Fundamentos do Cristianismo', date: '2026-09-29', type: 'exam', title: 'P1 — Avaliação Teórica 1' },
  { subject: 'Fundamentos do Cristianismo', date: '2026-11-24', type: 'assignment', title: 'SEM — Seminário' },
  { subject: 'Fundamentos do Cristianismo', date: '2026-12-01', type: 'exam', title: 'P2 — Avaliação Teórica 2' },
  { subject: 'Fundamentos do Cristianismo', date: '2026-12-15', type: 'exam', title: 'SUB — Substitutiva' },
];

// A Prova Interdisciplinar cai em 18/11 nos quatro planos: é uma prova só,
// não quatro. Entra como um evento único, sem matéria.
const INTERDISCIPLINAR = {
  date: '2026-11-18',
  type: 'exam',
  title: 'PI — Prova Interdisciplinar',
  description:
    'Prova interdisciplinar comum a Estrutura de Dados II, Probabilidade e ' +
    'Estatística, Engenharia de Software e Fundamentos do Cristianismo.',
};

function paraData(iso) {
  return new Date(`${iso}T03:00:00.000Z`);
}

/**
 * Descobre o horário da avaliação pela grade da matéria: se a data cai num dia
 * em que a matéria tem aula, usa o primeiro período daquele dia.
 * Devolve também um aviso quando a data não é dia de aula da matéria.
 */
function horarioEAviso(materia, iso) {
  if (!materia) return { time: undefined, aviso: 'matéria não encontrada no banco' };

  const diaSemana = new Date(`${iso}T12:00:00.000Z`).getUTCDay();
  const naGrade = (materia.schedule || []).find((s) => s.dayOfWeek === diaSemana);

  if (!naGrade) {
    return {
      time: undefined,
      aviso: `${iso} é ${NOME_DIA[diaSemana]}, mas ${materia.name} não tem aula nesse dia`,
    };
  }

  const primeiro = Math.min(...naGrade.periods);
  return { time: HORA_DO_PERIODO[primeiro], aviso: null };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) throw new Error('nenhum usuário admin encontrado');

  const materias = await Subject.find({ userId: admin._id, active: true }).lean();
  const porNome = new Map(materias.map((m) => [m.name, m]));

  console.log(`\nDono: ${admin.email}`);
  console.log(APLICAR ? '\n>>> MODO GRAVACAO\n' : '\n>>> SIMULACAO (use --apply para gravar)\n');

  const avisos = [];
  const aCriar = [];

  for (const a of AVALIACOES) {
    const materia = porNome.get(a.subject);
    const { time, aviso } = horarioEAviso(materia, a.date);
    if (aviso) avisos.push(`${a.title} (${a.subject}): ${aviso}`);

    aCriar.push({
      title: a.title,
      type: a.type,
      date: paraData(a.date),
      time,
      subject: a.subject,
      description: `${a.subject} — conforme plano de ensino 2026/2.`,
      recurring: false,
      completed: false,
      userId: admin._id,
      _iso: a.date,
    });
  }

  aCriar.push({
    ...INTERDISCIPLINAR,
    date: paraData(INTERDISCIPLINAR.date),
    time: undefined,
    subject: undefined,
    recurring: false,
    completed: false,
    userId: admin._id,
    _iso: INTERDISCIPLINAR.date,
  });

  aCriar.sort((x, y) => x.date - y.date);

  let criados = 0;
  let atualizados = 0;

  for (const ev of aCriar) {
    const { _iso, ...dados } = ev;
    const existente = await Event.findOne({
      userId: admin._id,
      title: dados.title,
      date: dados.date,
    });

    const acao = existente ? 'atualizar' : 'criar';
    if (existente) atualizados++;
    else criados++;

    console.log(
      `  [${acao}] ${_iso} ${(dados.time || '  -  ').padEnd(5)} ${dados.type.padEnd(10)} ` +
        `${dados.title}${dados.subject ? '  ·  ' + dados.subject : ''}`
    );

    if (APLICAR) {
      if (existente) {
        Object.assign(existente, dados);
        await existente.save();
      } else {
        await Event.create(dados);
      }
    }
  }

  console.log(`\n${criados} a criar, ${atualizados} a atualizar.`);

  if (avisos.length) {
    console.log('\nAVISOS (data fora do dia de aula da matéria):');
    avisos.forEach((a) => console.log('  ! ' + a));
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('\nFALHOU:', e.message);
  process.exit(1);
});
