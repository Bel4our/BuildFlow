import express from 'express';
import { getAllUsers, toggleUserStatus, deleteUser } from '../controllers/adminController.js';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(verifyToken, checkRole(['Администратор']));

router.get('/users', getAllUsers);
router.put('/users/:id/status', toggleUserStatus);
router.delete('/users/:id', deleteUser);

export default router;