/**
 * Renomeia os papéis do usuário e escopa as sugestões por turma.
 *
 *   node scripts/migrar-papeis.js            # mostra o que faria
 *   node scripts/migrar-papeis.js --apply    # grava
 *
 * O papel deixou de ser global. `admin` virava dono de tudo; agora quem manda
 * numa turma é definido em TurmaMember.role, e User.role diz apenas se a
 * pessoa administra a plataforma inteira.
 *
 *   admin   -> superadmin
 *   student -> user
 *
 * As sugestões ganham a turma de quem as criou: aprovar uma sugestão cria um
 * evento, e ele precisa nascer dentro de uma turma.
 *
 * Idempotente: só toca em documento que ainda está no formato antigo.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const User = require('../src/models/user');
const TurmaMember = require('../src/models/turmaMember');
const EventSuggestion = require('../src/models/eventSuggestion');

const APLICAR = process.argv.includes('--apply');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  console.log(APLICAR ? '\n>>> MODO GRAVACAO\n' : '\n>>> SIMULACAO (use --apply para gravar)\n');

  // O enum novo rejeita os valores antigos, então a leitura precisa ser crua.
  const usuarios = mongoose.connection.collection('users');

  console.log('Papeis do usuario:');
  for (const [de, para] of [['admin', 'superadmin'], ['student', 'user']]) {
    const n = await usuarios.countDocuments({ role: de });
    console.log(`  ${de.padEnd(8)} -> ${para.padEnd(11)} ${n} usuario(s)`);
    if (APLICAR && n > 0) {
      const r = await usuarios.updateMany({ role: de }, { $set: { role: para } });
      console.log(`            ${r.modifiedCount} atualizado(s)`);
    }
  }

  // Sugestões herdam a turma de quem as criou.
  const sugestoes = await EventSuggestion.find({ turmaId: { $exists: false } })
    .select('userId')
    .lean();

  console.log(`\nSugestoes sem turma: ${sugestoes.length}`);

  let semVinculo = 0;
  for (const s of sugestoes) {
    const vinculo = await TurmaMember.findOne({ userId: s.userId }).select('turmaId').lean();
    if (!vinculo) {
      semVinculo++;
      continue;
    }
    if (APLICAR) {
      await EventSuggestion.updateOne({ _id: s._id }, { $set: { turmaId: vinculo.turmaId } });
    }
  }
  if (sugestoes.length) {
    console.log(`  ${sugestoes.length - semVinculo} recebem turma pelo autor`);
    if (semVinculo) console.log(`  ${semVinculo} sem autor em turma alguma — ficam de fora`);
  }

  if (APLICAR) {
    const antigos = await usuarios.countDocuments({ role: { $in: ['admin', 'student'] } });
    const orfas = await EventSuggestion.countDocuments({ turmaId: { $exists: false } });
    console.log('\nResultado:');
    console.log(`  usuarios com papel antigo: ${antigos}`);
    console.log(`  sugestoes sem turma: ${orfas}`);
    if (antigos > 0) throw new Error('sobrou usuario com papel antigo');
    console.log('\nOK: papeis migrados.');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('\nFALHOU:', e.message);
  process.exit(1);
});
