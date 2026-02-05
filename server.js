const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./src/config/database');

// Carregar variáveis de ambiente
dotenv.config();

// Conectar ao banco de dados
connectDB();

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Logger apenas em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rotas
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/events', require('./src/routes/eventRoutes'));
app.use('/api/suggestions', require('./src/routes/suggestionsRoutes')); 
app.use('/api/subjects', require('./src/routes/subjectRoutes'));

// Rota de teste
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API do Calendário Acadêmico',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      events: '/api/events',
      suggestions: '/api/suggestions',
      subjects: '/api/subjects'
    }
  });
});

// Middleware de tratamento de erros 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada'
  });
});

// Middleware de tratamento de erros global
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Erro no servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Apenas iniciar o servidor se não estiver rodando no Vercel
if (process.env.VERCEL === undefined) {
  const PORT = process.env.PORT || 5000;

  const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em modo ${process.env.NODE_ENV} na porta ${PORT}`);
  });

  // Tratamento de rejeições não tratadas
  process.on('unhandledRejection', (err, promise) => {
    console.log(`❌ Erro: ${err.message}`);
    server.close(() => process.exit(1));
  });
}

// Exportar como handler serverless para Vercel
module.exports = app;