import express from 'express';
import { 
  createTask, 
  getMyTasks, 
  updateTask, 
  approveStage 
} from '../controllers/taskController.js';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import { createStage, deleteStage } from '../controllers/taskController.js';


const router = express.Router();

router.post('/', verifyToken, checkRole(['Администратор', 'Прораб']), createTask);

router.get('/my', verifyToken, checkRole(['Прораб']), getMyTasks);

router.put('/:id', verifyToken, checkRole(['Прораб']), upload.array('photos', 10), updateTask);

router.put('/stage/:stageId/approve', verifyToken, checkRole(['Заказчик']), approveStage);

router.post('/stage', verifyToken, checkRole(['Прораб', 'Администратор']), createStage);

router.delete('/stage/:stageId', verifyToken, checkRole(['Прораб']), deleteStage);

router.post('/', verifyToken, checkRole(['Прораб', 'Администратор']), createTask);
export default router;