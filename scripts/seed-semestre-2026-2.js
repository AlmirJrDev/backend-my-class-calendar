/**
 * Cadastra as matérias do semestre 2026/2 e desativa as de 2026/1.
 *
 * Roda em modo simulação por padrão; só grava com --apply:
 *
 *   node scripts/seed-semestre-2026-2.js            # mostra o que faria
 *   node scripts/seed-semestre-2026-2.js --apply    # grava
 *
 * É idempotente: identifica a matéria por nome + dono, então rodar de novo
 * atualiza em vez de duplicar.
 *
 * As matérias antigas são apenas desativadas (active: false). Elas seguram o
 * histórico de presença e notas do semestre passado, que precisa continuar
 * consultável.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Subject = require('../src/models/subject');
const User = require('../src/models/user');

const APLICAR = process.argv.includes('--apply');

// T03:00Z = meia-noite em Brasilia (UTC-3). Gravar T00:00Z faria as datas
// aparecerem um dia antes na interface.
const INICIO = new Date('2026-08-03T03:00:00.000Z');
const FIM = new Date('2026-12-16T03:00:00.000Z');

const NOME_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Dias da semana: 1 = segunda ... 4 = quinta.
// Períodos: 1ª 19:00 | 2ª 19:45 | 3ª 20:45 | 4ª 21:30 | 5ª 22:15
const MATERIAS = [
  {
    name: 'Estrutura de Dados II',
    code: 'G00253.1',
    teacher: 'Abraão da Silva Rodrigues Antas',
    color: '#6366f1',
    schedule: [{ dayOfWeek: 1, periods: [3, 4, 5] }],
    gradeFormula: [
      { key: 'P1', label: 'Prova 1', weight: 0.25, date: '2026-09-28' },
      { key: 'PI', label: 'Prova Interdisciplinar', weight: 0.1, date: '2026-11-18' },
      { key: 'P2', label: 'Prova 2', weight: 0.25, date: '2026-11-30' },
      { key: 'LE', label: 'Listas de Exercícios', weight: 0.2 },
      { key: 'TG', label: 'Trabalho Geral: Sistema de Gerenciamento de Dados', weight: 0.2 },
    ],
  },
  {
    name: 'Probabilidade e Estatística',
    code: 'G4047.15',
    teacher: 'Thais Michelli Stori da Silva',
    color: '#0ea5e9',
    schedule: [{ dayOfWeek: 2, periods: [1, 2] }],
    gradeFormula: [
      { key: 'P1', label: 'Prova 1', weight: 0.3, date: '2026-09-22' },
      { key: 'GR', label: 'Trabalho de Gráficos', weight: 0.1, date: '2026-09-29' },
      { key: 'PI', label: 'Prova Interdisciplinar', weight: 0.3, date: '2026-11-18' },
      { key: 'P2', label: 'Prova 2', weight: 0.2, date: '2026-12-01' },
      { key: 'PRO', label: 'Projeto Integrador', weight: 0.1, date: '2026-12-03' },
    ],
  },
  {
    name: 'Engenharia de Software',
    code: 'G00306.1',
    teacher: 'Adriana Aparecida Carnevalli Demetrio',
    color: '#10b981',
    schedule: [
      { dayOfWeek: 2, periods: [3] },
      { dayOfWeek: 3, periods: [3, 4, 5] },
    ],
    gradeFormula: [
      { key: 'PR1', label: 'Primeira Avaliação Teórica', weight: 0.3, date: '2026-09-30' },
      { key: 'TRB', label: 'Trabalho em grupo', weight: 0.2, date: '2026-10-21' },
      { key: 'PI', label: 'Prova Interdisciplinar', weight: 0.1, date: '2026-11-18' },
      { key: 'PGI', label: 'Projeto Integrador', weight: 0.1, date: '2026-11-24' },
      { key: 'PR2', label: 'Segunda Avaliação Teórica', weight: 0.3, date: '2026-12-02' },
    ],
  },
  {
    name: 'Fundamentos do Cristianismo',
    code: 'G2105.7',
    teacher: 'Tiago Sartorelli Prato',
    color: '#f59e0b',
    schedule: [{ dayOfWeek: 2, periods: [4, 5] }],
    gradeFormula: [
      { key: 'ATV', label: 'Estudos de Caso e Pequenos Grupos', weight: 0.1, date: '2026-08-25' },
      { key: 'P1', label: 'Avaliação Teórica 1', weight: 0.3, date: '2026-09-29' },
      { key: 'PI', label: 'Prova Interdisciplinar', weight: 0.1, date: '2026-11-18' },
      { key: 'SEM', label: 'Seminário', weight: 0.2, date: '2026-11-24' },
      { key: 'P2', label: 'Avaliação Teórica 2', weight: 0.3, date: '2026-12-01' },
    ],
  },
  // Sem plano de ensino recebido: entram com grade e chamada funcionando, mas
  // sem fórmula de nota. O professor e a fórmula saem pelo editor do admin.
  {
    name: 'Redes de Computadores',
    code: 'G4428.12',
    teacher: 'A definir',
    color: '#ec4899',
    schedule: [
      { dayOfWeek: 3, periods: [1, 2] },
      { dayOfWeek: 4, periods: [4, 5] },
    ],
    gradeFormula: [],
  },
  {
    name: 'Gerenciamento de Banco de Dados',
    code: 'G00263.1',
    teacher: 'A definir',
    color: '#8b5cf6',
    schedule: [{ dayOfWeek: 4, periods: [1, 2, 3] }],
    gradeFormula: [],
  },
];

/** Conta as aulas do semestre: cada ocorrência do dia da semana x nº de períodos. */
function totalDeAulas(schedule) {
  let total = 0;
  for (const { dayOfWeek, periods } of schedule) {
    const d = new Date(INICIO);
    while (d <= FIM) {
      if (d.getUTCDay() === dayOfWeek) total += periods.length;
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return total;
}

/** A média do app compara a soma ponderada direto com a nota mínima. */
function validarPesos(m) {
  if (m.gradeFormula.length === 0) return;
  const soma = m.gradeFormula.reduce((a, i) => a + i.weight, 0);
  if (Math.abs(soma - 1) > 1e-9) {
    throw new Error(`${m.name}: os pesos somam ${soma}, deveriam somar 1.0`);
  }
}

function descreverGrade(schedule) {
  return schedule
    .map((s) => `${NOME_DIA[s.dayOfWeek]} ${s.periods.join(',')}`)
    .join(' | ');
}

async function main() {
  MATERIAS.forEach(validarPesos);

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) throw new Error('nenhum usuário admin encontrado');

  console.log(`\nDono das matérias: ${admin.email}`);
  console.log(`Semestre: ${INICIO.toISOString().slice(0, 10)} a ${FIM.toISOString().slice(0, 10)}`);
  console.log(APLICAR ? '\n>>> MODO GRAVACAO\n' : '\n>>> SIMULACAO (use --apply para gravar)\n');

  const nomesNovos = MATERIAS.map((m) => m.name);

  // 1) Desativar o que sobrou do semestre anterior.
  const antigas = await Subject.find({
    userId: admin._id,
    active: true,
    name: { $nin: nomesNovos },
  });

  console.log(`Desativar ${antigas.length} materia(s) do semestre anterior:`);
  for (const a of antigas) {
    console.log(`  - ${a.name}`);
    if (APLICAR) {
      a.active = false;
      await a.save();
    }
  }

  // 2) Criar ou atualizar as deste semestre.
  console.log(`\nCadastrar ${MATERIAS.length} materia(s) de 2026/2:`);
  for (const m of MATERIAS) {
    const total = totalDeAulas(m.schedule);
    const dados = {
      name: m.name,
      code: m.code,
      teacher: m.teacher,
      color: m.color,
      schedule: m.schedule,
      gradeFormula: m.gradeFormula.map((i) => ({
        key: i.key,
        label: i.label,
        weight: i.weight,
        date: i.date ? new Date(`${i.date}T03:00:00.000Z`) : undefined,
      })),
      minimumGrade: 6,
      semesterStartDate: INICIO,
      semesterEndDate: FIM,
      totalClasses: total,
      userId: admin._id,
      active: true,
    };

    const existente = await Subject.findOne({ userId: admin._id, name: m.name });
    const acao = existente ? 'atualizar' : 'criar';

    console.log(
      `  - [${acao}] ${m.name} (${m.code}) — ${descreverGrade(m.schedule)} — ` +
        `${total} aulas — ${m.gradeFormula.length ? m.gradeFormula.length + ' avaliacoes' : 'SEM formula'}`
    );

    if (APLICAR) {
      if (existente) {
        Object.assign(existente, dados);
        await existente.save();
      } else {
        await Subject.create(dados);
      }
    }
  }

  if (APLICAR) {
    const ativas = await Subject.countDocuments({ userId: admin._id, active: true });
    console.log(`\nMaterias ativas ao final: ${ativas}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('\nFALHOU:', e.message);
  process.exit(1);
});
