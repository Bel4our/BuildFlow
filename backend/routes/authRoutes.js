import express from 'express';
import { register, login, updateProfile, disconnectTelegram, getMe } from '../controllers/authController.js'
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/me', verifyToken, getMe);
router.post('/register', register);
router.post('/login', login);  
router.put('/profile', verifyToken, updateProfile);
router.delete('/telegram', verifyToken, disconnectTelegram);

export default router;