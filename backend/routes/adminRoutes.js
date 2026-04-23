import express from 'express';
import { getAllUsers, toggleUserStatus,
     deleteUser, updateUserInfo, createUser } from '../controllers/adminController.js';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(verifyToken, checkRole(['Администратор']));

router.get('/users', getAllUsers);
router.put('/users/:id/status', toggleUserStatus);
router.put('/users/:id', verifyToken, checkRole(['Администратор']), updateUserInfo);
router.delete('/users/:id', deleteUser);
router.post('/users', createUser);

export default router;