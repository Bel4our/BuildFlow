import express from 'express';
import { getServices, createService, updateService, deleteService } from '../controllers/serviceController.js';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getServices); 
router.post('/', verifyToken, checkRole(['Администратор']), createService);
router.put('/:id', verifyToken, checkRole(['Администратор']), updateService);
router.delete('/:id', verifyToken, checkRole(['Администратор']), deleteService);

export default router;