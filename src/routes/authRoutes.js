const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// 🧪 ROTA DE TESTE - APENAS PARA DESENVOLVIMENTO
// Esta rota gera um token JWT para testar a API sem precisar
// de um sistema completo de autenticação

/**
 * @desc    Gerar token de teste para desenvolvimento
 * @route   POST /api/events/auth/test-login
 * @access  Public
 */
router.post('/test-login', (req, res) => {
  try {
    // Criar usuário de teste
    const testUser = {
      id: '507f1f77bcf86cd799439011', // ID fixo para testes
      email: 'teste@calendario.com',
      name: 'Usuário Teste'
    };

    // Gerar token JWT
    const token = jwt.sign(
      { 
        id: testUser.id, 
        email: testUser.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '1d' }
    );

    res.status(200).json({
      success: true,
      message: 'Token de teste gerado com sucesso',
      token: token,
      user: testUser,
      expiresIn: process.env.JWT_EXPIRE || '1d'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar token de teste',
      message: error.message
    });
  }
});

/**
 * @desc    Verificar token atual
 * @route   GET /api/events/auth/verify
 * @access  Private
 */
router.get('/verify', async (req, res) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token não fornecido'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    res.status(200).json({
      success: true,
      message: 'Token válido',
      user: {
        id: decoded.id,
        email: decoded.email
      },
      tokenInfo: {
        issuedAt: new Date(decoded.iat * 1000),
        expiresAt: new Date(decoded.exp * 1000)
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Token inválido ou expirado',
      message: error.message
    });
  }
});

module.exports = router;