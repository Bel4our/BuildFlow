import express from 'express';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { updateStageOrder, updateTaskOrder } from '../controllers/orderController.js';

const router = express.Router();

router.put('/stages/project/:projectId', verifyToken, checkRole(['Прораб', 'Администратор']), updateStageOrder);
router.put('/tasks/stage/:stageId', verifyToken, checkRole(['Прораб', 'Администратор']), updateTaskOrder);

export default router;