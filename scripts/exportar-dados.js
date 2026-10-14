/**
 * Gera a cópia dos dados de uma pessoa, para atender um pedido pela LGPD
 * (art. 18, II; prazo de 15 dias, art. 19). O pedido chega por e-mail no
 * contato da Política de Privacidade.
 *
 *   node scripts/exportar-dados.js pessoa@exemplo.com
 *
 * Só lê o banco. O arquivo sai em exportacoes/ (fora do git) e deve ser
 * enviado SÓ para o e-mail da própria conta; depois de enviado, apague-o.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { exportarDados } = require('../src/services/contaService');

const models = () => ({
  User: require('../src/models/user'),
  TurmaMember: require('../src/models/turmaMember'),
  Attendance: require('../src/models/attendance'),
  GradeEntry: require('../src/models/gradeEntry'),
  EventSuggestion: require('../src/models/eventSuggestion'),
  EventNote: require('../src/models/eventNote'),
  Material: require('../src/models/material'),
  Chamada: require('../src/models/chamada')
});

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email.includes('@')) throw new Error('uso: node scripts/exportar-dados.js pessoa@exemplo.com');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  try {
    const m = models();
    const usuario = await m.User.findOne({ email }).select('_id').lean();
    if (!usuario) throw new Error(`nenhuma conta com o e-mail ${email}`);

    const dados = await exportarDados(usuario._id, m);
    const pasta = path.join(__dirname, '..', 'exportacoes');
    fs.mkdirSync(pasta, { recursive: true });
    const arquivo = path.join(pasta, `dados-${email.replace(/[^a-z0-9]+/g, '_')}-${dados.geradoEm.slice(0, 10)}.json`);
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));

    const resumo = ['presencas', 'notas', 'sugestoes', 'observacoes', 'materiais', 'avisosDeChamada', 'turmas']
      .map((parte) => `${parte}: ${dados[parte].length}`)
      .join(', ');
    console.log(`Arquivo gerado: ${arquivo}\n${resumo}\nEnvie só para ${email} e apague o arquivo depois.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error('\nFALHOU:', e.message);
  process.exit(1);
});
