const User = require('../models/user');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const {
  evaluateOtpAttempt,
  generateOtp,
  hashOtp
} = require('../services/otpService');

// Configurar transporter de email
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// FROM_NAME/FROM_EMAIL nem sempre estão definidos no ambiente; sem o fallback
// o cabeçalho vira "undefined <undefined>" e o SMTP rejeita o envio.
const emailFrom = () => {
  const name = process.env.FROM_NAME || 'Calendário de Aulas';
  const address = process.env.FROM_EMAIL || process.env.EMAIL_USER;
  return `${name} <${address}>`;
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

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          error: 'Este email já está cadastrado. Use "Solicitar Acesso" para fazer login.'
        });
      }
    } else {
      user = await User.create({
        email: email.toLowerCase(),
        name,
        role: 'student'
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    user.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;

    await user.save();

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    try {
      const transporter = createEmailTransporter();

      await transporter.sendMail({
        from: emailFrom(),
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
                <div class="header"><h1>📚 Bem-vindo!</h1></div>
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
                <div class="footer"><p>Calendário Acadêmico © ${new Date().getFullYear()}</p></div>
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
        ...(process.env.NODE_ENV === 'development' && { message: error.message })
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao registrar usuário',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Verificar email e fazer login
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
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
        error: 'Token inválido ou expirado'
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    await user.save();

    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
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
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Solicitar acesso — envia OTP + Magic Link
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

    // Math.random não serve para segredo: é previsível a partir de saídas
    // anteriores. generateOtp usa crypto.randomInt.
    const otp = generateOtp();

    // Gerar magic link token
    const magicToken = crypto.randomBytes(32).toString('hex');

    // Salvar hashes — ambos expiram juntos em 15 minutos
    user.verificationToken = crypto.createHash('sha256').update(magicToken).digest('hex');
    user.verificationOtp = hashOtp(otp);
    user.verificationTokenExpire = Date.now() + 15 * 60 * 1000;
    user.otpAttempts = 0;

    await user.save();

    const accessUrl = `${process.env.FRONTEND_URL}/magic-login?token=${magicToken}`;

    try {
      const transporter = createEmailTransporter();

      await transporter.sendMail({
        from: emailFrom(),
        to: user.email,
        subject: 'Seu código de acesso - Calendário de Aulas',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .otp-box { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                .otp-code { letter-spacing: 10px; font-size: 42px; font-weight: bold; color: #667eea; font-family: monospace; }
                .divider { text-align: center; color: #999; margin: 20px 0; font-size: 14px; }
                .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header"><h1>🔐 Acesso ao Sistema</h1></div>
                <div class="content">
                  <h2>Olá ${user.name}!</h2>

                  <p>Use o código abaixo para entrar no dispositivo que preferir:</p>

                  <div class="otp-box">
                    <p style="margin: 0 0 8px; color: #666; font-size: 14px;">Seu código de acesso</p>
                    <div class="otp-code">${otp}</div>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #999;">Expira em 15 minutos</p>
                  </div>

                  <div class="divider">— ou acesse com um clique —</div>

                  <div style="text-align: center;">
                    <p style="font-size: 13px; color: #888; margin-bottom: 8px;">
                      O link abrirá no dispositivo onde você clicar
                    </p>
                    <a href="${accessUrl}" class="button">Acessar Sistema</a>
                  </div>

                  <p style="margin-top: 24px; font-size: 13px; color: #999;">
                    Se você não solicitou este acesso, ignore este email.
                  </p>
                </div>
                <div class="footer"><p>Calendário Acadêmico © ${new Date().getFullYear()}</p></div>
              </div>
            </body>
          </html>
        `
      });

      res.status(200).json({
        success: true,
        message: 'Código de acesso enviado para seu email!',
        email: user.email
      });
    } catch (error) {
      user.verificationToken = undefined;
      user.verificationOtp = undefined;
      user.verificationTokenExpire = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        error: 'Erro ao enviar email',
        ...(process.env.NODE_ENV === 'development' && { message: error.message })
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao processar solicitação',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Login via OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Por favor, forneça email e código'
      });
    }

    const account = await User.findOne({ email: email.toLowerCase() });

    const { outcome } = evaluateOtpAttempt(account, otp);

    if (outcome === 'locked') {
      return res.status(429).json({
        success: false,
        error: 'Muitas tentativas incorretas. Solicite um novo código.'
      });
    }

    if (outcome === 'mismatch') {
      account.otpAttempts = (account.otpAttempts || 0) + 1;
      await account.save();
    }

    // Mesma resposta para código errado e inexistente/expirado: não revela se
    // o email está cadastrado nem se ainda há código válido.
    if (outcome !== 'ok') {
      return res.status(400).json({
        success: false,
        error: 'Código inválido ou expirado'
      });
    }

    const user = account;

    // Limpar ambos os tokens
    user.verificationToken = undefined;
    user.verificationOtp = undefined;
    user.verificationTokenExpire = undefined;
    user.otpAttempts = 0;
    await user.save();

    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
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
      error: 'Erro ao verificar código',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
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

    // Limpar ambos os tokens
    user.verificationToken = undefined;
    user.verificationOtp = undefined;
    user.verificationTokenExpire = undefined;
    await user.save();

    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
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
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};

// @desc    Obter usuário atual
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-verificationToken -verificationOtp -verificationTokenExpire');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar usuário',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    });
  }
};