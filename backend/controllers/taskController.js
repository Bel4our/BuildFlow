import { Task, ProjectStage, Attachment, User, Project } from '../models/index.js';
import { broadcastToProject, sendNotification } from '../services/telegramBot.js';
import sequelize from '../config/db.js';
import fs from 'fs';
import path from 'path';

const extractDateString = (val) => {
  if (!val) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (typeof val === 'string' && val.includes('T')) return val.split('T')[0];
  
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const createStage = async (req, res) => {
  try {
    const { projectId, name, description, startDate, plannedEndDate } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Название этапа не может быть пустым' });
    }

    const sdStr = extractDateString(startDate);
    const edStr = extractDateString(plannedEndDate);

    if (!sdStr || !edStr) {
      return res.status(400).json({ message: 'Даты этапа обязательны и должны быть корректными' });
    }
    
    const p = await Project.findByPk(projectId);
    if (!p) return res.status(404).json({ message: 'Проект не найден' });
    
    const sd = new Date(sdStr);
    const ed = new Date(edStr);
    const psd = p.startDate ? new Date(p.startDate) : null;
    const ped = p.plannedEndDate ? new Date(p.plannedEndDate) : null;

    sd.setHours(0,0,0,0);
    ed.setHours(0,0,0,0);
    if (psd) psd.setHours(0,0,0,0);
    if (ped) ped.setHours(0,0,0,0);

    if (psd && ped && (sd < psd || ed > ped || sd > ed)) {
      return res.status(400).json({ message: 'Даты этапа выходят за рамки сроков проекта' });
    }
    
    const stage = await ProjectStage.create({ 
      projectId, 
      name: name.substring(0, 255), 
      description: description || '', 
      startDate: sequelize.literal(`CAST('${sdStr}' AS DATETIME)`), 
      plannedEndDate: sequelize.literal(`CAST('${edStr}' AS DATETIME)`) 
    });
    
    req.io.to(projectId.toString()).emit('stage_status_updated');
    res.status(201).json(stage);
  } catch (error) { 
    res.status(500).json({ message: error.parent?.message || error.message || 'Внутренняя ошибка сервера' }); 
  }
};

export const requestStageApproval = async (req, res) => {
  try {
    const stage = await ProjectStage.findByPk(req.params.stageId, { include: [Project] });
    stage.status = 'ожидает утверждения';
    await stage.save();
    req.io.to(stage.projectId.toString()).emit('stage_status_updated');
    broadcastToProject(stage.Project.id, ['Заказчик'], `🔔 В проекте "${stage.Project.name}" прораб просит принять этап "${stage.name}".`);
    res.json({ message: 'Requested' });
  } catch (err) { res.status(500).json({ message: err.parent?.message || err.message || 'Error' }); }
};

export const cancelStageApproval = async (req, res) => {
  try {
    const stage = await ProjectStage.findByPk(req.params.stageId);
    if (stage.status !== 'ожидает утверждения') {
      return res.status(400).json({ message: 'Нельзя отменить запрос для этого этапа' });
    }
    stage.status = 'в работе';
    await stage.save();
    req.io.to(stage.projectId.toString()).emit('stage_status_updated');
    res.json({ message: 'Cancelled' });
  } catch (err) { res.status(500).json({ message: err.parent?.message || err.message || 'Error' }); }
};

export const updateTask = async (req, res) => {
  try {
    const { status, reportText } = req.body;
    const task = await Task.findByPk(req.params.id, { include: [{ model: ProjectStage, include: [Project] }] });
    
    const oldStatus = task.status;
    if (status) task.status = status;
    if (reportText !== undefined) task.reportText = reportText.substring(0, 4000);
    await task.save();
    
    req.io.to(task.ProjectStage.projectId.toString()).emit('stage_status_updated');

    if (status && status !== oldStatus) {
      if (status === 'выполнена') {
        broadcastToProject(task.ProjectStage.Project.id, ['Заказчик'], `✅ В проекте "${task.ProjectStage.Project.name}" выполнена задача:\n"${task.description}"`);
      } else if (status === 'в работе' && oldStatus === 'выполнена') {
        broadcastToProject(task.ProjectStage.Project.id, ['Заказчик'], `🔄 В проекте "${task.ProjectStage.Project.name}" задача возвращена в работу:\n"${task.description}"`);
      } else if (status === 'новая' && oldStatus === 'в работе') {
        broadcastToProject(task.ProjectStage.Project.id, ['Заказчик'], `🔙 В проекте "${task.ProjectStage.Project.name}" задача возвращена в "Новые":\n"${task.description}"`);
      }
    }

    if (req.files && req.files.length > 0) {
      const attachments = req.files.map(file => ({
        taskId: req.params.id,
        filePath: `/uploads/${file.filename}`,
        originalName: file.originalname,
        uploadedByUserId: req.user.id
      }));
      await Attachment.bulkCreate(attachments);
    }
    res.json(await Task.findByPk(req.params.id, { include: Attachment }));
  } catch (error) { res.status(500).json({ message: error.parent?.message || error.message || 'Error' }); }
};

export const approveStage = async (req, res) => { 
    try { 
        const stage = await ProjectStage.findByPk(req.params.stageId, { include: [Project] }); 
        stage.status = 'утверждено'; 
        stage.actualEndDate = new Date(); 
        await stage.save(); 
        req.io.to(stage.projectId.toString()).emit('stage_status_updated');
        broadcastToProject(stage.Project.id, ['Прораб'], `✅ В проекте "${stage.Project.name}" заказчик утвердил этап "${stage.name}"!`); 
        res.json(stage); 
    } catch (err) { res.status(500).json({ message: 'Error' }); } 
};

export const rejectStage = async (req, res) => { 
    try { 
        const stage = await ProjectStage.findByPk(req.params.stageId, { include: [Task, Project] }); 
        stage.status = 'в работе'; 
        await stage.save(); 
        for (let task of stage.Tasks) { 
            if (task.status === 'выполнена') { 
                task.status = 'в работе'; 
                await task.save(); 
            } 
        } 
        req.io.to(stage.projectId.toString()).emit('stage_status_updated');
        broadcastToProject(stage.Project.id, ['Прораб'], `❌ В проекте "${stage.Project.name}" заказчик отклонил этап "${stage.name}". Задачи возвращены в работу.`); 
        res.json({ message: 'Reject' }); 
    } catch (err) { res.status(500).json({ message: 'Error' }); } 
};

export const renameStage = async (req, res) => { 
  try { 
    const stage = await ProjectStage.findByPk(req.params.stageId, { include: [Task, Project] });
    if (!stage) return res.status(404).json({ message: 'Этап не найден' });

    const wasApproved = stage.status === 'утверждено';
    
    const updateData = {
      name: req.body.name ? req.body.name.substring(0, 255) : stage.name,
    };

    if (req.body.startDate) {
      const sdStr = extractDateString(req.body.startDate);
      if (!sdStr) return res.status(400).json({ message: 'Неверный формат даты начала' });
      updateData.startDate = sequelize.literal(`CAST('${sdStr}' AS DATETIME)`);
    }
    
    if (req.body.plannedEndDate) {
      const edStr = extractDateString(req.body.plannedEndDate);
      if (!edStr) return res.status(400).json({ message: 'Неверный формат даты окончания' });
      updateData.plannedEndDate = sequelize.literal(`CAST('${edStr}' AS DATETIME)`);
    }

    if (wasApproved) {
      updateData.status = 'в работе';
      updateData.actualEndDate = null;

      for (const task of stage.Tasks) {
        if (task.status === 'выполнена') {
          task.status = 'в работе';
          await task.save();
        }
      }
      
      broadcastToProject(stage.projectId, ['Заказчик', 'Прораб'], `⚠️ Прораб изменил утвержденный этап "${stage.name}" в проекте "${stage.Project.name}". Этап возвращен в работу и требует повторной приемки.`);
    }

    await stage.update(updateData); 
    req.io.to(stage.projectId.toString()).emit('stage_status_updated');
    res.json({ message: 'Updated' }); 
  } catch (error) { 
    res.status(500).json({ message: error.parent?.message || error.message || 'Error' }); 
  } 
};

export const deleteStage = async (req, res) => { try { const stage = await ProjectStage.findByPk(req.params.stageId); const pid = stage.projectId; await stage.destroy(); req.io.to(pid.toString()).emit('stage_status_updated'); res.json({ message: 'Deleted' }); } catch (error) { res.status(500).json({ message: 'Error' }); } };

export const createTask = async (req, res) => { 
  try { 
    if (!req.body.description || req.body.description.trim().length === 0) {
      return res.status(400).json({ message: 'Описание задачи не может быть пустым' });
    }
    const t = await Task.create({ stageId: req.body.stageId, assignedUserId: req.body.assignedUserId, description: req.body.description.substring(0, 4000) }); 
    const stage = await ProjectStage.findByPk(req.body.stageId);
    if(stage) req.io.to(stage.projectId.toString()).emit('stage_status_updated');
    res.status(201).json(t); 
  } catch (error) { res.status(500).json({ message: error.parent?.message || error.message || 'Error' }); } 
};

export const deleteTask = async (req, res) => { try { const task = await Task.findByPk(req.params.id, {include: [ProjectStage]}); const pid = task.ProjectStage.projectId; await task.destroy(); req.io.to(pid.toString()).emit('stage_status_updated'); res.json({ message: 'Deleted' }); } catch (error) { res.status(500).json({ message: 'Error' }); } };
export const editTask = async (req, res) => { 
  try { 
    const task = await Task.findByPk(req.params.id, {include: [ProjectStage]}); 
    await task.update({ description: req.body.description.substring(0, 4000) }); 
    req.io.to(task.ProjectStage.projectId.toString()).emit('stage_status_updated');
    res.json({ message: 'Updated' }); 
  } catch (err) { res.status(500).json({ message: 'Error' }); } 
};
export const getMyTasks = async (req, res) => { try { res.json(await Task.findAll({ where: { assignedUserId: req.user.id }, include: [{ model: ProjectStage, include: [Project] }, Attachment] })); } catch (error) { res.status(500).json({ message: 'Error' }); } };
export const deleteAttachment = async (req, res) => { try { const a = await Attachment.findByPk(req.params.id, {include: [{model: Task, include: [ProjectStage]}]}); const pid = a.Task.ProjectStage.projectId; if (fs.existsSync(path.join(process.cwd(), a.filePath))) fs.unlinkSync(path.join(process.cwd(), a.filePath)); await a.destroy(); req.io.to(pid.toString()).emit('stage_status_updated'); res.json({ message: 'Deleted' }); } catch (error) { res.status(500).json({ message: 'Error' }); } };

export const rejectTask = async (req, res) => { 
    try { 
        const task = await Task.findByPk(req.params.id, { include: [{ model: ProjectStage, include: [Project] }] }); 
        task.status = 'в работе'; 
        await task.save(); 
        req.io.to(task.ProjectStage.projectId.toString()).emit('stage_status_updated');
        broadcastToProject(task.ProjectStage.Project.id, ['Прораб'], `❌ В проекте "${task.ProjectStage.Project.name}" заказчик вернул задачу:\n"${task.description}"`); 
        res.json({ message: 'Reject' }); 
    } catch (err) { res.status(500).json({ message: 'Error' }); } 
};

export const requestTransfer = async (req, res) => { try { const task = await Task.findByPk(req.params.id, {include:[ProjectStage]}); task.transferToUserId = req.body.targetUserId; await task.save(); req.io.to(task.ProjectStage.projectId.toString()).emit('stage_status_updated'); res.json({ message: 'Requested' }); } catch (err) { res.status(500).json({ message: 'Error' }); } };
export const cancelTransfer = async (req, res) => { try { const task = await Task.findByPk(req.params.id, {include:[ProjectStage]}); task.transferToUserId = null; await task.save(); req.io.to(task.ProjectStage.projectId.toString()).emit('stage_status_updated'); res.json({ message: 'Canceled' }); } catch (err) { res.status(500).json({ message: 'Error' }); } };
export const acceptTransfer = async (req, res) => { try { const task = await Task.findByPk(req.params.id, {include:[ProjectStage]}); task.assignedUserId = req.user.id; task.transferToUserId = null; await task.save(); req.io.to(task.ProjectStage.projectId.toString()).emit('stage_status_updated'); res.json({ message: 'Accepted' }); } catch (err) { res.status(500).json({ message: 'Error' }); } };
export const rejectTransfer = async (req, res) => { try { const task = await Task.findByPk(req.params.id, {include:[ProjectStage]}); task.transferToUserId = null; await task.save(); req.io.to(task.ProjectStage.projectId.toString()).emit('stage_status_updated'); res.json({ message: 'Rejected' }); } catch (err) { res.status(500).json({ message: 'Error' }); } };

export const adminReassignTask = async (req, res) => { 
  try { 
    const task = await Task.findByPk(req.params.id, { include: [{ model: ProjectStage, include: [Project] }] });
    const oldUserId = task.assignedUserId;
    const newUserId = req.body.newUserId;

    if (oldUserId !== newUserId) {
        const oldUser = await User.findByPk(oldUserId);
        const newUser = await User.findByPk(newUserId);
        const projectName = task.ProjectStage.Project.name;
        
        if (oldUser) {
            sendNotification(oldUser, `Администратор забрал у вас задачу "${task.description}" в проекте "${projectName}".`, task.ProjectStage.projectId);
        }
        if (newUser) {
            sendNotification(newUser, `Администратор назначил вам новую задачу "${task.description}" в проекте "${projectName}".`, task.ProjectStage.projectId);
        }
    }

    task.assignedUserId = newUserId; 
    task.transferToUserId = null; 
    await task.save(); 
    req.io.to(task.ProjectStage.projectId.toString()).emit('stage_status_updated');
    res.json({ message: 'Reassigned' }); 
  } catch (err) { res.status(500).json({ message: err.parent?.message || err.message || 'Error' }); } 
};