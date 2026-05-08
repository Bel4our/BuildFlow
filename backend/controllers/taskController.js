import { Task, ProjectStage, Attachment, User, Project, Role } from '../models/index.js';
import { broadcastToProject } from '../services/telegramBot.js';
import { triggerReapproval } from '../services/planService.js';
import fs from 'fs';
import path from 'path';

export const createTask = async (req, res) => {
  try {
    const { stageId, assignedUserId, description } = req.body;
    const stage = await ProjectStage.findByPk(stageId, { include: [Project] });
    if (!stage) return res.status(404).json({ message: 'Этап не найден' });
    if (stage.status === 'утверждено') return res.status(403).json({ message: 'Нельзя добавлять задачи в утвержденный этап' });

    const task = await Task.create({ stageId, assignedUserId, description: description.substring(0, 500) });
    await triggerReapproval(stage.projectId, 'добавлена новая задача');
    res.status(201).json({ message: 'Задача создана', task });
  } catch (error) { res.status(500).json({ message: 'Ошибка создания задачи' }); }
};

export const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { assignedUserId: req.user.id },
      include: [{ model: ProjectStage, attributes: ['name', 'status', 'projectId'], include: [{ model: Project, attributes: ['name'] }] }, { model: Attachment } ]
    });
    res.json(tasks);
  } catch (error) { res.status(500).json({ message: 'Ошибка получения задач' }); }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reportText } = req.body; 
    
    const task = await Task.findByPk(id, { 
      include: [{ model: ProjectStage, include: [{ model: Task }, { model: Project }] }] 
    });
    
    if (!task) return res.status(404).json({ message: 'Задача не найдена' });

    if (status && status === 'в работе' && task.status === 'новая') {
      broadcastToProject(task.ProjectStage.Project.id, ['Заказчик'], `▶️ Прораб взял в работу задачу:\n"${task.description}"\n(Проект: ${task.ProjectStage.Project.name})`);
    }

    if (status) task.status = status;
    if (reportText !== undefined) task.reportText = reportText.substring(0, 1000);
    
    await task.save();

    if (req.files && req.files.length > 0) {
      const attachmentsData = req.files.map(file => ({ taskId: id, filePath: `/uploads/${file.filename}`, uploadedByUserId: req.user.id }));
      await Attachment.bulkCreate(attachmentsData);
    }

    const stage = task.ProjectStage;
    if (status === 'выполнена' && stage) {
      const updatedStage = await ProjectStage.findByPk(stage.id, { include: [Task] });
      const allDone = updatedStage.Tasks.every(t => t.status === 'выполнена');

      if (allDone && stage.Project) {
        broadcastToProject(stage.Project.id, ['Заказчик'], `🔔 Этап завершен!\n\nПрораб выполнил все задачи в этапе "${stage.name}" (проект "${stage.Project.name}").\n\nПроверьте отчет на сайте или в боте.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Получить файлы', callback_data: `files_${stage.id}` }],
              [{ text: 'Отклонить', callback_data: `reject_${stage.id}` }, { text: 'Утвердить', callback_data: `approve_${stage.id}` }]
            ]
          }
        });
      }
    }
    const result = await Task.findByPk(id, { include: Attachment });
    res.json({ message: 'Задача успешно обновлена', task: result });
  } catch (error) { res.status(500).json({ message: 'Ошибка сервера при обновлении задачи' }); }
};

export const approveStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const stage = await ProjectStage.findByPk(stageId, { include: [Project] });
    stage.status = 'утверждено';
    stage.actualEndDate = new Date();
    await stage.save();
    broadcastToProject(stage.Project.id, ['Прораб'], `✅ Заказчик утвердил этап "${stage.name}" в проекте "${stage.Project.name}"!`);
    res.json(stage);
  } catch (err) { res.status(500).json({ message: 'Error' }); }
};

export const createStage = async (req, res) => {
  try {
    const { projectId, name, description, plannedEndDate } = req.body;
    const safeName = name.substring(0, 255);
    const stage = await ProjectStage.create({ projectId, name: safeName, description, plannedEndDate: plannedEndDate || null });
    await triggerReapproval(projectId, `добавлен этап "${safeName}"`);
    res.status(201).json(stage);
  } catch (error) { res.status(500).json({ message: 'Ошибка создания этапа' }); }
};

export const deleteStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const stage = await ProjectStage.findByPk(stageId);
    if (!stage) return res.status(404).json({ message: 'Этап не найден' });
    if (stage.status === 'утверждено') return res.status(403).json({ message: 'Нельзя удалить утвержденный этап' });
    const projectId = stage.projectId;
    await stage.destroy();
    await triggerReapproval(projectId, 'удален этап');
    res.json({ message: 'Этап удален' });
  } catch (error) { res.status(500).json({ message: 'Ошибка удаления этапа' }); }
};

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id, { include: [ProjectStage] });
    if (!task) return res.status(404).json({ message: 'Задача не найдена' });
    if (task.ProjectStage.status === 'утверждено') return res.status(403).json({ message: 'Нельзя удалить задачу из утвержденного этапа' });
    const projectId = task.ProjectStage.projectId;
    await task.destroy();
    await triggerReapproval(projectId, 'удалена задача');
    res.json({ message: 'Задача удалена' });
  } catch (error) { res.status(500).json({ message: 'Ошибка удаления задачи' }); }
};

export const rejectStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const stage = await ProjectStage.findByPk(stageId, { include: [Task, Project] });
    stage.status = 'в работе';
    await stage.save();
    for (let task of stage.Tasks) {
      if (task.status === 'выполнена') {
        task.status = 'в работе';
        await task.save();
      }
    }
    broadcastToProject(stage.Project.id, ['Прораб'], `❌ Заказчик отклонил этап "${stage.name}" в проекте "${stage.Project.name}". Задачи возвращены в работу.`);
    res.json({ message: 'Этап отклонен, задачи возвращены в работу' });
  } catch (err) { res.status(500).json({ message: 'Ошибка отклонения этапа' }); }
};

export const renameStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const { name, plannedEndDate } = req.body;
    const stage = await ProjectStage.findByPk(stageId, { include: [Project] });
    await stage.update({ name: name.substring(0, 255), plannedEndDate: plannedEndDate || null });
    await triggerReapproval(stage.projectId, `изменен этап "${name}"`);
    res.json({ message: 'Этап обновлен' });
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
};

export const editTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const task = await Task.findByPk(id, { include: [ProjectStage] });
    await task.update({ description: description.substring(0, 500) });
    await triggerReapproval(task.ProjectStage.projectId, 'отредактирована задача');
    res.json({ message: 'Задача обновлена' });
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
};

export const deleteAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const attachment = await Attachment.findByPk(id);
    if (!attachment) return res.status(404).json({ message: 'Файл не найден' });
    const filePath = path.join(process.cwd(), attachment.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await attachment.destroy();
    res.json({ message: 'Файл удален' });
  } catch (error) { res.status(500).json({ message: 'Ошибка удаления файла' }); }
};

export const rejectTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id, { include: [{ model: ProjectStage, include: [Project] }] });
    task.status = 'в работе';
    await task.save();
    if (req.user.role === 'Заказчик') {
      broadcastToProject(task.ProjectStage.Project.id, ['Прораб'], `❌ Заказчик вернул в работу задачу:\n"${task.description}"\n(Проект: ${task.ProjectStage.Project.name})`);
    }
    res.json({ message: 'Задача возвращена в работу' });
  } catch (err) { res.status(500).json({ message: 'Ошибка отклонения задачи' }); }
};

export const requestTransfer = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const task = await Task.findByPk(req.params.id);
    task.transferToUserId = targetUserId;
    await task.save();
    res.json({ message: 'Запрос отправлен' });
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
};

export const cancelTransfer = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    task.transferToUserId = null;
    await task.save();
    res.json({ message: 'Запрос отменен' });
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
};

export const acceptTransfer = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    task.assignedUserId = req.user.id;
    task.transferToUserId = null;
    await task.save();
    res.json({ message: 'Принято' });
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
};

export const rejectTransfer = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    task.transferToUserId = null;
    await task.save();
    res.json({ message: 'Отклонено' });
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
};

export const adminReassignTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    task.assignedUserId = req.body.newUserId;
    task.transferToUserId = null;
    await task.save();
    res.json({ message: 'Переназначено' });
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
};