const User = require('../models/user');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configurar transporter de email
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465', // true para 465, false para outros
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// @desc    Registrar novo usuário (estudante)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Por favor, forneça email e nome'
      });
    }

    // Verificar se usuário já existe
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          error: 'Este email já está cadastrado. Use "Solicitar Acesso" para fazer login.'
        });
      }
      // Se não verificado, reenviar email
    } else {
      // Criar novo usuário
      user = await User.create({
        email: email.toLowerCase(),
        name,
        role: 'student'
      });
    }

    // Gerar token de verificação
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    user.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 horas

    await user.save();

    // Criar link de verificação
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Enviar email
    try {
      const transporter = createEmailTransporter();
      
      await transporter.sendMail({
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: user.email,
        subject: 'Verificação de Email - Calendário de Aulas',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>📚 Bem-vindo!</h1>
                </div>
                <div class="content">
                  <h2>Olá ${user.name}!</h2>
                  <p>Você está a um passo de acessar o sistema de calendário de aulas.</p>
                  <p>Clique no botão abaixo para verificar seu email e começar:</p>
                  <div style="text-align: center;">
                    <a href="${verificationUrl}" class="button">Verificar Email</a>
                  </div>
                  <p style="margin-top: 20px; font-size: 14px; color: #666;">
                    Este link expira em 24 horas.<br>
                    Se você não se cadastrou, ignore este email.
                  </p>
                </div>
                <div class="footer">
                  <p>Calendário Acadêmico © ${new Date().getFullYear()}</p>
                </div>
              </div>
            </body>
          </html>
        `
      });

      res.status(200).json({
        success: true,
        message: 'Email de verificação enviado! Verifique sua caixa de entrada.',
        email: user.email
      });
    } catch (error) {
      user.verificationToken = undefined;
      user.verificationTokenExpire = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        error: 'Erro ao enviar email de verificação',
        message: error.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao registrar usuário',
      message: error.message
    });
  }
};

// @desc    Verificar email e fazer login
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    // Hash do token para comparar
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Buscar usuário com token válido
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Token inválido ou expirado'
      });
    }

    // Marcar como verificado
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    await user.save();

    // Gerar JWT
    const jwtToken = jwt.sign(
      { 
        id: user._id, 
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      message: 'Email verificado com sucesso!',
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar email',
      message: error.message
    });
  }
};

// @desc    Solicitar novo link de acesso (magic link)
// @route   POST /api/auth/request-access
// @access  Public
exports.requestAccess = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Por favor, forneça um email'
      });
    }

    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isVerified: true 
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Email não encontrado ou não verificado'
      });
    }

    // Gerar token de acesso
    const accessToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');
    user.verificationTokenExpire = Date.now() + 15 * 60 * 1000; // 15 minutos

    await user.save();

    // Criar link de acesso
    const accessUrl = `${process.env.FRONTEND_URL}/magic-login?token=${accessToken}`;

    // Enviar email
    try {
      const transporter = createEmailTransporter();
      
      await transporter.sendMail({
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: user.email,
        subject: 'Link de Acesso - Calendário de Aulas',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🔐 Acesso Rápido</h1>
                </div>
                <div class="content">
                  <h2>Olá ${user.name}!</h2>
                  <p>Clique no botão abaixo para acessar o sistema:</p>
                  <div style="text-align: center;">
                    <a href="${accessUrl}" class="button">Acessar Sistema</a>
                  </div>
                  <p style="margin-top: 20px; font-size: 14px; color: #666;">
                    Este link expira em 15 minutos.<br>
                    Se você não solicitou este acesso, ignore este email.
                  </p>
                </div>
                <div class="footer">
                  <p>Calendário Acadêmico © ${new Date().getFullYear()}</p>
                </div>
              </div>
            </body>
          </html>
        `
      });

      res.status(200).json({
        success: true,
        message: 'Link de acesso enviado para seu email!',
        email: user.email
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao enviar email',
        message: error.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao processar solicitação',
      message: error.message
    });
  }
};

// @desc    Login via magic link
// @route   GET /api/auth/magic-login/:token
// @access  Public
exports.magicLogin = async (req, res) => {
  try {
    const { token } = req.params;

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Link inválido ou expirado'
      });
    }

    // Limpar token
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    await user.save();

    // Gerar JWT
    const jwtToken = jwt.sign(
      { 
        id: user._id, 
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso!',
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao fazer login',
      message: error.message
    });
  }
};

// @desc    Obter usuário atual
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-verificationToken -verificationTokenExpire');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar usuário',
      message: error.message
    });
  }
};