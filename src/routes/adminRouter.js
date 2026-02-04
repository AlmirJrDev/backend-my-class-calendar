const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../src/models/User');

// Carregar variáveis de ambiente
dotenv.config();

// Conectar ao MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB conectado');
  } catch (err) {
    console.error('❌ Erro ao conectar MongoDB:', err);
    process.exit(1);
  }
};

const createAdmin = async () => {
  await connectDB();

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@calendario.com';
    const adminName = process.env.ADMIN_NAME || 'Administrador';

    // Verificar se admin já existe
    let admin = await User.findOne({ email: adminEmail.toLowerCase() });

    if (admin) {
      console.log('\n⚠️  Admin já existe!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📧 Email: ${admin.email}`);
      console.log(`👤 Nome: ${admin.name}`);
      console.log(`🔑 Role: ${admin.role}`);
      console.log(`✅ Verificado: ${admin.isVerified}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      if (!admin.isVerified) {
        admin.isVerified = true;
        admin.verificationToken = undefined;
        admin.verificationTokenExpire = undefined;
        await admin.save();
        console.log('✅ Admin marcado como verificado!\n');
      }
      
      process.exit(0);
    }

    // Criar admin
    admin = await User.create({
      email: adminEmail.toLowerCase(),
      name: adminName,
      role: 'admin',
      isVerified: true
    });

    console.log('\n✅ Admin criado com sucesso!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${admin.email}`);
    console.log(`👤 Nome: ${admin.name}`);
    console.log(`🔑 Role: ${admin.role}`);
    console.log(`✅ Verificado: ${admin.isVerified}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  IMPORTANTE: Para fazer login, use a rota:');
    console.log('POST /api/auth/request-access');
    console.log(`Body: { "email": "${adminEmail}" }\n`);
    console.log('Você receberá um email com link de acesso.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar admin:', error);
    process.exit(1);
  }
};

createAdmin();