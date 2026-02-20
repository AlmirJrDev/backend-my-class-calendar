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

// Rotas públicas
router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.post('/request-access', requestAccess);
router.get('/magic-login/:token', magicLogin);
router.post('/verify-otp', verifyOtp);

// Rotas privadas
router.get('/me', protect, getMe);

module.exports = router;