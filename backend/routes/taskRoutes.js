import express from 'express';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import { 
    createTask, getMyTasks, updateTask, approveStage, createStage, deleteStage, deleteTask, rejectStage, 
    renameStage, editTask, deleteAttachment, rejectTask, requestTransfer, acceptTransfer, rejectTransfer, adminReassignTask
} from '../controllers/taskController.js';

const router = express.Router();

router.get('/my', verifyToken, checkRole(['Прораб']), getMyTasks);

router.post('/stage', verifyToken, checkRole(['Прораб', 'Администратор']), createStage);
router.delete('/stage/:stageId', verifyToken, checkRole(['Прораб']), deleteStage);
router.put('/stage/:stageId/approve', verifyToken, checkRole(['Заказчик']), approveStage);
router.put('/stage/:stageId/reject', verifyToken, checkRole(['Заказчик']), rejectStage);
router.put('/stage/:stageId/rename', verifyToken, checkRole(['Прораб', 'Администратор']), renameStage);

router.delete('/attachment/:id', verifyToken, checkRole(['Прораб', 'Администратор']), deleteAttachment);

router.put('/:id/reject', verifyToken, checkRole(['Заказчик', 'Прораб']), rejectTask);
router.put('/:id/edit', verifyToken, checkRole(['Прораб', 'Администратор']), editTask);
router.put('/:id/transfer', verifyToken, checkRole(['Прораб']), requestTransfer);
router.put('/:id/transfer/accept', verifyToken, checkRole(['Прораб']), acceptTransfer);
router.put('/:id/transfer/reject', verifyToken, checkRole(['Прораб']), rejectTransfer);
router.put('/:id/reassign', verifyToken, checkRole(['Администратор']), adminReassignTask);

router.post('/', verifyToken, checkRole(['Администратор', 'Прораб']), createTask);
router.put('/:id', verifyToken, checkRole(['Прораб']), upload.array('photos', 10), updateTask);
router.delete('/:id', verifyToken, checkRole(['Прораб', 'Администратор']), deleteTask);

export default router;