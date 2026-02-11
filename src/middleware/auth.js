const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Middleware para proteger rotas
exports.protect = async (req, res, next) => {
  let token;

  // Verificar se o token existe no header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Verificar se o token foi enviado
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado - Token não fornecido'
    });
  }

  try {
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar usuário completo
    const user = await User.findById(decoded.id).select('-verificationToken -verificationTokenExpire');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        error: 'Email não verificado'
      });
    }

    // Adicionar usuário à requisição
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado - Token inválido',
      message: error.message
    });
  }
};

// Middleware de autenticação OPCIONAL - permite acesso público mas adiciona usuário se autenticado
exports.optionalAuth = async (req, res, next) => {
  let token;

  // Verificar se o token existe no header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Se não houver token, continua sem usuário (acesso público)
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar usuário completo
    const user = await User.findById(decoded.id).select('-verificationToken -verificationTokenExpire');

    if (user && user.isVerified) {
      // Adicionar usuário à requisição se válido
      req.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // Se token inválido, continua sem usuário (acesso público)
    req.user = null;
    next();
  }
};

// Middleware para verificar se é admin
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Acesso negado. Função ${req.user.role} não autorizada para esta ação`
      });
    }
    next();
  };
};

// Middleware específico para admin
exports.adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas administradores podem realizar esta ação'
    });
  }
  next();
};

// Função auxiliar para gerar token JWT
exports.generateToken = (userId, email, role) => {
  return jwt.sign(
    { id: userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};