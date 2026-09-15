/**
 * Troca o índice único de turmas.shareToken por um parcial (só strings).
 *
 * O índice antigo era `sparse`, que ignora o campo ausente mas não o null. Como
 * toda turma sem compartilhamento guardava null, a segunda turma criada batia
 * no índice e "Criar turma" falhava para todo mundo depois da primeira.
 *
 * Simulação por padrão. Para gravar: node scripts/corrigir-indice-sharetoken.js --apply
 * Idempotente: rodar de novo não muda nada.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--apply');
const NOME = 'shareToken_1';
const FILTRO = { shareToken: { $type: 'string' } };

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const turmas = mongoose.connection.db.collection('turmas');

  const atual = (await turmas.indexes()).find((i) => i.name === NOME);
  const jaCorrigido =
    atual?.unique && JSON.stringify(atual.partialFilterExpression) === JSON.stringify(FILTRO);
  const comNull = await turmas.countDocuments({ shareToken: { $type: 'null' } });

  console.log(APLICAR ? 'APLICANDO' : 'SIMULAÇÃO (use --apply para gravar)');
  console.log('índice atual:', atual ? JSON.stringify(atual) : 'nenhum');
  console.log('turmas com shareToken null gravado:', comNull);

  if (!APLICAR) {
    console.log(jaCorrigido ? 'índice já está correto' : 'trocaria o índice pelo parcial');
    console.log('removeria o null gravado em', comNull, 'turma(s)');
    return mongoose.disconnect();
  }

  // Tira o null gravado: o campo passa a só existir quando o link está ligado.
  const limpeza = await turmas.updateMany({ shareToken: { $type: 'null' } }, { $unset: { shareToken: '' } });
  console.log('null removido de', limpeza.modifiedCount, 'turma(s)');

  if (!jaCorrigido) {
    if (atual) await turmas.dropIndex(NOME);
    await turmas.createIndex(
      { shareToken: 1 },
      { name: NOME, unique: true, partialFilterExpression: FILTRO }
    );
    console.log('índice recriado como parcial');
  } else {
    console.log('índice já estava correto');
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
