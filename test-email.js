
const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('🧪 Testando configuração de email...\n');
console.log('Configurações:');
console.log(`- Host: ${process.env.EMAIL_HOST}`);
console.log(`- Port: ${process.env.EMAIL_PORT}`);
console.log(`- User: ${process.env.EMAIL_USER}`);
console.log(`- From: ${process.env.FROM_EMAIL}\n`);

const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Altere para seu email de teste
const emailDestino = 'seu-email-de-teste@email.com';

transporter.sendMail({
  from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
  to: emailDestino,
  subject: '✅ Teste de Email - Calendário de Aulas',
  html: `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #667eea;">🎉 Email funcionando!</h2>
      <p>Se você recebeu este email, sua configuração está correta.</p>
      <p><strong>Configurações testadas:</strong></p>
      <ul>
        <li>Host: ${process.env.EMAIL_HOST}</li>
        <li>Port: ${process.env.EMAIL_PORT}</li>
        <li>User: ${process.env.EMAIL_USER}</li>
      </ul>
      <p>Agora você pode usar o sistema de autenticação sem senha! 🚀</p>
    </div>
  `
}, (err, info) => {
  if (err) {
    console.error('❌ Erro ao enviar email:');
    console.error(err);
    console.log('\n💡 Dicas:');
    console.log('1. Verifique se as credenciais no .env estão corretas');
    console.log('2. Se usando Gmail, certifique-se de usar uma "senha de app"');
    console.log('3. Se usando Mailtrap, verifique as credenciais SMTP');
    process.exit(1);
  } else {
    console.log('✅ Email enviado com sucesso!');
    console.log(`📧 Para: ${emailDestino}`);
    console.log(`📨 Response: ${info.response}`);
    console.log('\n🎉 Configuração de email está funcionando!');
    
    if (process.env.EMAIL_HOST.includes('mailtrap')) {
      console.log('\n💡 Verifique sua inbox do Mailtrap para ver o email');
    }
    
    process.exit(0);
  }
});