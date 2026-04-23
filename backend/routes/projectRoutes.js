import express from 'express';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { createProject, getProjects, updateProject, updatePlanStatus, getProjectMessages, sendProjectMessage, completeProject, markMessagesRead } from '../controllers/projectController.js';

const router = express.Router();

router.get('/', verifyToken, getProjects);
router.post('/', verifyToken, checkRole(['Администратор']), createProject);
router.put('/:id', verifyToken, checkRole(['Администратор']), updateProject); 
router.put('/:id/plan-status', verifyToken, updatePlanStatus);
router.get('/:id/messages', verifyToken, getProjectMessages);
router.put('/:id/messages/read', verifyToken, markMessagesRead);
router.post('/:id/messages', verifyToken, sendProjectMessage);
router.put('/:id/complete', verifyToken, checkRole(['Заказчик']), completeProject);

export default router;