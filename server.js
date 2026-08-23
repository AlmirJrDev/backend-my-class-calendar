const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./src/config/database');
const { apiLimiter } = require('./src/middleware/rateLimit');

// Carregar variáveis de ambiente
dotenv.config();

// Conectar ao banco de dados
connectDB();

const app = express();

// O Vercel roda atrás de proxy: sem isso o rate limit enxerga um IP só.
app.set('trust proxy', 1);

// Cabeçalhos de segurança. A API só devolve JSON, então não precisa de CSP.
app.use(helmet({ contentSecurityPolicy: false }));

// Middlewares
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// CORS restrito às origens conhecidas do front.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:4173' // vite preview
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Sem Origin = chamada server-to-server (curl, health check), liberada.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origem não permitida pelo CORS'));
    },
    credentials: true
  })
);

// Logger apenas em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use('/api', apiLimiter);

// Rotas
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/events', require('./src/routes/eventRoutes'));
app.use('/api/suggestions', require('./src/routes/suggestionsRoutes'));
app.use('/api/subjects', require('./src/routes/subjectRoutes'));
app.use('/api/grades', require('./src/routes/gradeRoutes'));
app.use('/api/attendance', require('./src/routes/attendanceRoutes'));

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
      subjects: '/api/subjects',
      grades: '/api/grades',
      attendance: '/api/attendance'
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
  process.on('unhandledRejection', (err) => {
    console.log(`❌ Erro: ${err.message}`);
    server.close(() => process.exit(1));
  });
}

// Exportar como handler serverless para Vercel
module.exports = app;
