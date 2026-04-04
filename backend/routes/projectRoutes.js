import express from 'express';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { createProject, getProjects, updateProject } from '../controllers/projectController.js';
import { updatePlanStatus, getProjectMessages, sendProjectMessage } from '../controllers/projectController.js';

const router = express.Router();

router.get('/', verifyToken, getProjects);

router.post('/', verifyToken, checkRole(['Администратор']), createProject);
router.put('/:id', verifyToken, checkRole(['Администратор']), updateProject); 

router.put('/:id/plan-status', verifyToken, updatePlanStatus);
router.get('/:id/messages', verifyToken, getProjectMessages);
router.post('/:id/messages', verifyToken, sendProjectMessage);

export default router;