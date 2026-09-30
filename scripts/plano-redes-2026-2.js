/**
 * Completa Redes de Computadores com o plano de ensino (G4428.12): fórmula de
 * média e as avaliações e atividades importantes no calendário.
 *
 *   node scripts/plano-redes-2026-2.js            # mostra o que faria
 *   node scripts/plano-redes-2026-2.js --apply    # grava
 *
 * Por que um script próprio e não rodar os seeds de novo: depois deles vieram
 * as turmas e a ligação evento → nota (subjectId + gradeKey). Os seeds não
 * gravam turmaId, e evento sem turma não aparece para ninguém. Aqui tudo nasce
 * na turma da matéria e já ligado ao item da fórmula.
 *
 * Idempotente: identifica o evento por turma + título + data.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Event = require('../src/models/event');
const Subject = require('../src/models/subject');

const APLICAR = process.argv.includes('--apply');

const MATERIA = 'Redes de Computadores';

const HORA_DO_PERIODO = { 1: '19:00', 2: '19:45', 3: '20:45', 4: '21:30', 5: '22:15' };

// Média final = AT1 * 0.1 + AT2 * 0.1 + AT3 * 0.1 + PrInd * 0.1 + P1 * 0.6
// A PrInd fica com a chave PI, como nas outras matérias.
const FORMULA = [
  { key: 'AT1', label: 'Atividade 1', weight: 0.1, date: '2026-09-17' },
  { key: 'AT2', label: 'Atividade 2', weight: 0.1, date: '2026-10-15' },
  { key: 'AT3', label: 'Atividade 3', weight: 0.1, date: '2026-11-04' },
  { key: 'PI', label: 'Prova Interdisciplinar', weight: 0.1, date: '2026-11-18' },
  { key: 'P1', label: 'Prova 1', weight: 0.6, date: '2026-12-02' },
];

// As atividades avaliativas são os TBL (Team Based Learning) do cronograma.
const EVENTOS = [
  {
    date: '2026-09-17',
    type: 'exam',
    gradeKey: 'AT1',
    title: 'AT1 — Atividade 1',
    description: 'TBL (Team Based Learning) — estudo de caso em aula. Vale 10% da média.',
    // Entrou antes do plano, anunciada em aula como "Prova". É a mesma data:
    // renomeia em vez de criar outra.
    tituloAntigo: 'Prova',
  },
  {
    date: '2026-10-15',
    type: 'exam',
    gradeKey: 'AT2',
    title: 'AT2 — Atividade 2',
    description: 'TBL (Team Based Learning) — estudo de caso em aula. Vale 10% da média.',
  },
  {
    date: '2026-11-04',
    type: 'exam',
    gradeKey: 'AT3',
    title: 'AT3 — Atividade 3',
    description: 'TBL (Team Based Learning) — estudo de caso em aula. Vale 10% da média.',
  },
  {
    date: '2026-11-11',
    type: 'ativity',
    title: 'Revisão gamificada',
    description: 'Revisão com jogos; o feedback sai na aula seguinte (12/11).',
  },
  {
    date: '2026-11-26',
    type: 'ativity',
    title: 'Revisão para a P1',
  },
  {
    date: '2026-12-02',
    type: 'exam',
    gradeKey: 'P1',
    title: 'P1 — Prova 1',
    description: 'Vale 60% da média.',
  },
  {
    date: '2026-12-09',
    type: 'exam',
    title: 'SUB1 — Prova Substitutiva',
  },
];

const PI_TITULO = 'PI — Prova Interdisciplinar';
const PI_DESCRICAO =
  'Prova interdisciplinar comum a Estrutura de Dados II, Probabilidade e ' +
  'Estatística, Engenharia de Software, Fundamentos do Cristianismo, ' +
  'Gerenciamento de Banco de Dados e Redes de Computadores.';

const paraData = (iso) => new Date(`${iso}T03:00:00.000Z`);

/** Primeiro período da matéria no dia; avisa se o dia não tem aula dela. */
function horario(materia, iso) {
  const dia = new Date(`${iso}T12:00:00.000Z`).getUTCDay();
  const naGrade = materia.schedule.find((s) => s.dayOfWeek === dia);
  if (!naGrade) {
    console.log(`  ! ${iso} não é dia de aula de ${materia.name}`);
    return undefined;
  }
  return HORA_DO_PERIODO[Math.min(...naGrade.periods)];
}

async function main() {
  const soma = FORMULA.reduce((a, i) => a + i.weight, 0);
  if (Math.abs(soma - 1) > 1e-9) throw new Error(`os pesos somam ${soma}, deveriam somar 1.0`);

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  const materias = await Subject.find({ name: MATERIA, active: true });
  if (materias.length !== 1) {
    throw new Error(`esperava 1 matéria "${MATERIA}" ativa, achei ${materias.length}`);
  }
  const materia = materias[0];
  const { turmaId } = materia;
  if (!turmaId) throw new Error('a matéria não tem turma');

  console.log(APLICAR ? '\n>>> MODO GRAVACAO\n' : '\n>>> SIMULACAO (use --apply para gravar)\n');

  // 1) Fórmula de média.
  console.log(`Formula de ${MATERIA} (antes: ${materia.gradeFormula.length} itens):`);
  FORMULA.forEach((i) => console.log(`  ${i.key.padEnd(4)} ${String(i.weight).padEnd(4)} ${i.date}  ${i.label}`));
  if (APLICAR) {
    materia.code = 'G4428.12';
    materia.teacher = 'Clevison Lamas Veloso';
    materia.gradeFormula = FORMULA.map((i) => ({ ...i, date: paraData(i.date) }));
    await materia.save();
  }

  // 2) Eventos da matéria.
  console.log('\nEventos:');
  for (const e of EVENTOS) {
    const date = paraData(e.date);
    const dados = {
      turmaId,
      title: e.title,
      type: e.type,
      date,
      time: horario(materia, e.date),
      subject: MATERIA,
      subjectId: materia._id,
      gradeKey: e.gradeKey,
      description: e.description || `${MATERIA} — conforme plano de ensino 2026/2.`,
      recurring: false,
      userId: materia.userId,
    };

    let existente = await Event.findOne({ turmaId, title: e.title, date });
    let acao = 'atualizar';
    if (!existente && e.tituloAntigo) {
      existente = await Event.findOne({ turmaId, title: e.tituloAntigo, date, subject: MATERIA });
      if (existente) acao = `renomear "${e.tituloAntigo}"`;
    }
    if (!existente) acao = 'criar';

    console.log(
      `  [${acao}] ${e.date} ${(dados.time || '  -  ').padEnd(5)} ${e.type.padEnd(10)} ` +
        `${e.title}${e.gradeKey ? `  (${e.gradeKey})` : ''}`
    );

    if (APLICAR) {
      if (existente) {
        existente.set(dados);
        await existente.save();
      } else {
        await Event.create(dados);
      }
    }
  }

  // 3) A prova interdisciplinar é um evento só para todas as matérias.
  const pi = await Event.findOne({ turmaId, title: PI_TITULO, date: paraData('2026-11-18') });
  if (pi) {
    console.log(`\n[atualizar] ${PI_TITULO}: inclui Redes na descrição`);
    if (APLICAR) {
      pi.description = PI_DESCRICAO;
      await pi.save();
    }
  } else {
    console.log(`\n! ${PI_TITULO} não encontrada na turma`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('\nFALHOU:', e.message);
  process.exit(1);
});
