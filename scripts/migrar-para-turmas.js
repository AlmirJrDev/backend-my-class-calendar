/**
 * Adota o conteúdo que já existe numa turma inicial.
 *
 *   node scripts/migrar-para-turmas.js            # mostra o que faria
 *   node scripts/migrar-para-turmas.js --apply    # grava
 *
 * Idempotente: identifica a turma pelo dono + semestre e só preenche turmaId
 * onde ainda falta. Rodar de novo não duplica nada.
 *
 * Não mexe em presença nem em nota: elas são pessoais e chegam à turma pela
 * matéria, então continuam como estão.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const Turma = require('../src/models/turma');
const TurmaMember = require('../src/models/turmaMember');
const Subject = require('../src/models/subject');
const Event = require('../src/models/event');
const User = require('../src/models/user');

const APLICAR = process.argv.includes('--apply');

const NOME_DA_TURMA = 'Sistemas de Informação — noturno';
const SEMESTRE = '2026/2';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  const dono = await User.findOne({ role: 'admin' });
  if (!dono) throw new Error('nenhum usuário admin encontrado para ser o dono da turma');

  console.log(APLICAR ? '\n>>> MODO GRAVACAO\n' : '\n>>> SIMULACAO (use --apply para gravar)\n');

  // 1) A turma. Reaproveita se já existir, para o script poder rodar de novo.
  let turma = await Turma.findOne({ ownerId: dono._id, semester: SEMESTRE });
  if (turma) {
    console.log(`Turma ja existe: "${turma.name}" (${turma.semester})`);
  } else {
    console.log(`Criar turma: "${NOME_DA_TURMA}" (${SEMESTRE}) — dono ${dono.email}`);
    if (APLICAR) {
      turma = await Turma.create({
        name: NOME_DA_TURMA,
        semester: SEMESTRE,
        ownerId: dono._id
      });
    }
  }

  const turmaId = turma ? turma._id : null;

  // 2) Todo mundo que já usa o sistema entra na turma. O admin como
  //    representante, os demais como alunos.
  const usuarios = await User.find({}).select('email role isVerified');
  console.log(`\nVincular ${usuarios.length} usuario(s):`);

  for (const u of usuarios) {
    const papel = u.role === 'admin' ? 'representante' : 'aluno';
    const jaTem = turmaId ? await TurmaMember.findOne({ turmaId, userId: u._id }) : null;

    console.log(`  ${jaTem ? '[ja vinculado]' : '[vincular]   '} ${papel.padEnd(14)} ${u.email}`);

    if (APLICAR && !jaTem) {
      await TurmaMember.create({ turmaId, userId: u._id, role: papel });
    }
  }

  // 3) Matérias e eventos passam a pertencer à turma.
  console.log('\nAdotar conteudo existente:');

  for (const [rotulo, Model] of [['materias', Subject], ['eventos', Event]]) {
    const semTurma = await Model.countDocuments({ turmaId: { $exists: false } });
    const total = await Model.countDocuments();

    console.log(`  ${rotulo.padEnd(9)} ${semTurma} sem turma, de ${total} no total`);

    if (APLICAR && semTurma > 0) {
      const r = await Model.updateMany(
        { turmaId: { $exists: false } },
        { $set: { turmaId } }
      );
      console.log(`            -> ${r.modifiedCount} atualizado(s)`);
    }
  }

  // 4) Conferência: nada pode sobrar sem turma depois de gravar.
  if (APLICAR) {
    const orfas = await Subject.countDocuments({ turmaId: { $exists: false } });
    const orfaos = await Event.countDocuments({ turmaId: { $exists: false } });
    const membros = await TurmaMember.countDocuments({ turmaId });

    console.log('\nResultado:');
    console.log(`  membros da turma: ${membros}`);
    console.log(`  materias sem turma: ${orfas}`);
    console.log(`  eventos sem turma: ${orfaos}`);

    if (orfas > 0 || orfaos > 0) {
      throw new Error('sobrou conteudo sem turma — a migracao nao fechou');
    }
    console.log('\nOK: todo conteudo pertence a uma turma.');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('\nFALHOU:', e.message);
  process.exit(1);
});
