const express = require('express');
const router = express.Router();
const {
  register,
  verifyEmail,
  requestAccess,
  magicLogin,
  getMe,
  verifyOtp
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  requestAccessLimiter,
  verifyOtpLimiter
} = require('../middleware/rateLimit');

// Rotas públicas
router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.post('/request-access', requestAccessLimiter, requestAccess);
router.get('/magic-login/:token', verifyOtpLimiter, magicLogin);
router.post('/verify-otp', verifyOtpLimiter, verifyOtp);

// Rotas privadas
router.get('/me', protect, getMe);

module.exports = router;