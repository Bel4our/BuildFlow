import { Task, ProjectStage, Attachment, User, Project, Role } from '../models/index.js';
import { sendNotification } from '../services/telegramBot.js';
import fs from 'fs';
import path from 'path';

const triggerReapproval = async (projectId, actionText) => {
  const project = await Project.findByPk(projectId, { include: [{ model: User, as: 'Users', include: [Role] }] });
  if (project && project.planStatus === 'approved') {
    project.planStatus = 'pending_approval';
    await project.save();
    const clients = project.Users.filter(u => u.Role.name === 'Заказчик');
    clients.forEach(c => sendNotification(c, `⚠️ Прораб изменил план проекта "${project.name}" (${actionText}). План возвращен на утверждение.`, project.id));
  }
};

export const createTask = async (req, res) => {
  try {
    const { stageId, assignedUserId, description } = req.body;
    if (!stageId || !assignedUserId || !description) {
      return res.status(400).json({ message: "Не все поля заполнены" });
    }
    
    const stage = await ProjectStage.findByPk(stageId, { include: [Project] });
    if (!stage) return res.status(404).json({ message: 'Этап не найден' });
    if (stage.status === 'утверждено') return res.status(403).json({ message: 'Нельзя добавлять задачи в утвержденный этап' });

    const safeDesc = description.substring(0, 500);
    const task = await Task.create({ stageId, assignedUserId, description: safeDesc });
    
    const assignedUser = await User.findByPk(assignedUserId);
    if (assignedUser && stage.Project) {
      sendNotification(assignedUser, `Новая задача в проекте "${stage.Project.name}" (Этап: "${stage.name}"):\n\n${safeDesc}`, stage.Project.id);
    }

    await triggerReapproval(stage.projectId, 'добавлена новая задача');

    res.status(201).json({ message: 'Задача создана', task });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка создания задачи' });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { assignedUserId: req.user.id },
      include: [
        { model: ProjectStage, attributes: ['name', 'status', 'projectId'], include: [{ model: Project, attributes: ['name'] }] },
        { model: Attachment } 
      ]
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения задач' });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; 
    
    const task = await Task.findByPk(id, { 
      include: [{ 
        model: ProjectStage, 
        include: [
          { model: Task }, 
          { model: Project, include: [{ model: User, as: 'Users', include: [Role] }] }
        ] 
      }] 
    });
    
    if (!task) return res.status(404).json({ message: 'Задача не найдена' });

    if (status) {
      task.status = status;
      await task.save();
    }

    if (req.files && req.files.length > 0) {
      const attachmentsData = req.files.map(file => ({
        taskId: id,
        filePath: `/uploads/${file.filename}`,
        uploadedByUserId: req.user.id
      }));
      await Attachment.bulkCreate(attachmentsData);
    }

    const stage = task.ProjectStage;
    if (status === 'выполнена' && stage) {
      const updatedStage = await ProjectStage.findByPk(stage.id, { include: [Task] });
      const allDone = updatedStage.Tasks.every(t => t.status === 'выполнена');

      if (allDone && stage.Project && stage.Project.Users) {
        const clients = stage.Project.Users.filter(u => u.Role?.name === 'Заказчик');
        clients.forEach(client => {
          sendNotification(client, `🔔 Этап завершен!\n\nПрораб выполнил все задачи в этапе "${stage.name}" (проект "${stage.Project.name}").\n\nПроверьте отчет на сайте или в боте.`, stage.Project.id, {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Получить файлы', callback_data: `files_${stage.id}` }],
                [{ text: 'Отклонить', callback_data: `reject_${stage.id}` }, { text: 'Утвердить', callback_data: `approve_${stage.id}` }]
              ]
            }
          });
        });
      }
    }

    const result = await Task.findByPk(id, { include: Attachment });
    res.json({ message: 'Задача успешно обновлена', task: result });

  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера при обновлении задачи' });
  }
};

export const approveStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const stage = await ProjectStage.findByPk(stageId, { include: [Project] });
    stage.status = 'утверждено';
    await stage.save();

    const projectUsers = await stage.Project.getUsers();
    projectUsers.forEach(u => {
      sendNotification(u, `Этап "${stage.name}" в проекте "${stage.Project.name}" успешно утверждён!`, stage.Project.id);
    });

    res.json(stage);
  } catch (err) { res.status(500).json({ message: 'Error' }); }
};

export const createStage = async (req, res) => {
  try {
    const { projectId, name, description } = req.body;
    const safeName = name.substring(0, 255);
    const stage = await ProjectStage.create({ projectId, name: safeName, description });
    
    await triggerReapproval(projectId, `добавлен этап "${safeName}"`);

    res.status(201).json(stage);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка создания этапа' });
  }
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
  } catch (error) {
    res.status(500).json({ message: 'Ошибка удаления этапа' });
  }
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
  } catch (error) {
    res.status(500).json({ message: 'Ошибка удаления задачи' });
  }
};

export const rejectStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const stage = await ProjectStage.findByPk(stageId, { include: [Task, { model: Project, include: [{ model: User, as: 'Users', include: [Role] }] }] });
    
    stage.status = 'в работе';
    await stage.save();

    for (let task of stage.Tasks) {
      if (task.status === 'выполнена') {
        task.status = 'в работе';
        await task.save();
      }
    }

    const builders = stage.Project.Users.filter(u => u.Role.name === 'Прораб');
    builders.forEach(b => {
      sendNotification(b, `Заказчик отклонил этап "${stage.name}" в проекте "${stage.Project.name}". Задачи возвращены в работу, требуется исправление.`, stage.Project.id);
    });

    res.json({ message: 'Этап отклонен, задачи возвращены в работу' });
  } catch (err) { res.status(500).json({ message: 'Ошибка отклонения этапа' }); }
};

export const renameStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const { name } = req.body;
    const safeName = name.substring(0, 255);
    
    const stage = await ProjectStage.findByPk(stageId);
    if (!stage) return res.status(404).json({ message: 'Этап не найден' });
    if (stage.status === 'утверждено') return res.status(403).json({ message: 'Нельзя переименовать утвержденный этап' });

    await stage.update({ name: safeName });
    
    await triggerReapproval(stage.projectId, `переименован этап на "${safeName}"`);

    res.json({ message: 'Этап переименован' });
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
};

export const editTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const safeDesc = description.substring(0, 500);

    const task = await Task.findByPk(id, { include: [ProjectStage] });
    if (!task) return res.status(404).json({ message: 'Задача не найдена' });
    if (task.ProjectStage.status === 'утверждено') return res.status(403).json({ message: 'Нельзя изменить задачу в утвержденном этапе' });

    await task.update({ description: safeDesc });

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
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    await attachment.destroy();
    res.json({ message: 'Файл удален' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка удаления файла' });
  }
};

export const rejectTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id, { include: [{ model: ProjectStage, include: [{ model: Project, include: [{ model: User, as: 'Users', include: [Role] }] }] }] });
    
    task.status = 'в работе';
    await task.save();

    if (req.user.role === 'Заказчик') {
      const builders = task.ProjectStage.Project.Users.filter(u => u.Role.name === 'Прораб');
      builders.forEach(b => {
        sendNotification(b, `Заказчик вернул в работу задачу:\n"${task.description}"\nПроект: ${task.ProjectStage.Project.name}`, task.ProjectStage.Project.id);
      });
    }

    res.json({ message: 'Задача возвращена в работу' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка отклонения задачи' });
  }
};