import { Project, ProjectStage, User, Task, Attachment, Role, Message } from '../models/index.js';
import { Op } from 'sequelize';
import { sendNotification } from '../services/telegramBot.js';

export const getProjects = async (req, res) => {
  try {
    const { role, id } = req.user;
    
    let projects;
    if (role === 'Администратор') {
      projects = await Project.findAll({
        include: [
          { 
            model: ProjectStage,
            include: [{ model: Task, include: [{ model: Attachment }] }]
          },
          { 
            model: User, 
            as: 'Users', 
            attributes: ['id', 'fullName', 'email'],
            include: [{ model: Role }] 
          }
        ]
      });
    } else {
      const user = await User.findByPk(id, {
        include: [{
          model: Project,
          as: 'Projects', 
          include: [
            { model: ProjectStage, include: [{ model: Task, include: [{ model: Attachment }] }] },
            { 
              model: User, 
              as: 'Users', 
              attributes: ['id', 'fullName', 'email'],
              include: [{ model: Role }] 
            }
          ]
        }]
      });
      projects = user.Projects;
    }
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения проектов' });
  }
};

export const createProject = async (req, res) => {
  try {
    const { name, description, startDate, plannedEndDate, userIds } = req.body;
    
    const project = await Project.create({ name, description, startDate, plannedEndDate });
    
    if (userIds && userIds.length > 0) {
      await project.setUsers(userIds);
    }

    res.status(201).json({ message: 'Проект создан', project });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка при создании проекта' });
  }
};

export const updatePlanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { planStatus } = req.body; 
    const project = await Project.findByPk(id, {
      include: [{ model: User, as: 'Users', include: [Role] }]
    });
    
    if (!project) return res.status(404).json({ message: 'Проект не найден' });

    await project.update({ planStatus });

    const clients = project.Users.filter(u => u.Role.name === 'Заказчик');
    const builders = project.Users.filter(u => u.Role.name === 'Прораб');

    if (planStatus === 'pending_approval') {
      clients.forEach(c => sendNotification(c, `Прораб отправил план проекта "${project.name}" на утверждение.`, project.id));
    } else if (planStatus === 'approved') {
      builders.forEach(b => sendNotification(b, `Заказчик утвердил план проекта "${project.name}".`, project.id));
    } else if (planStatus === 'rejected') {
      builders.forEach(b => sendNotification(b, `Заказчик отклонил план проекта "${project.name}". Требуются изменения.`, project.id));
    }

    res.json({ message: `Статус плана изменен на ${planStatus}`, project });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка изменения статуса плана' });
  }
};

export const getProjectMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await Message.findAll({
      where: { projectId: id },
      include: [{ model: User, as: 'sender', attributes: ['id', 'fullName', 'roleId'] }],
      order: [['createdAt', 'ASC']]
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка загрузки чата' });
  }
};

export const markMessagesRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [updatedCount] = await Message.update(
      { isRead: true },
      { where: { projectId: id, senderId: { [Op.ne]: userId }, isRead: false } }
    );

    if (updatedCount > 0) {
      req.io.to(id).emit('messages_read', { readerId: userId });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка обновления статуса' });
  }
};

export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, startDate, plannedEndDate, status, userIds } = req.body;
    
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ message: 'Проект не найден' });
    
    await project.update({ name, description, startDate, plannedEndDate, status });
    
    if (userIds) {
      await project.setUsers(userIds);
    }
    
    res.json({ message: 'Проект обновлен', project });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка обновления проекта' });
  }
};

export const sendProjectMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const message = await Message.create({
      text,
      projectId: id,
      senderId: req.user.id
    });

    const fullMessage = await Message.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'fullName', 'roleId'] }],
    });

    req.io.to(id).emit('message_broadcast', fullMessage);

    res.status(201).json(fullMessage);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка отправки сообщения' });
  }
};

export const completeProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [{ model: User, as: 'Users' }]
    });
    project.status = 'completed';
    await project.save();

    project.Users.forEach(u => {
      sendNotification(u, `Проект "${project.name}" успешно завершен! Поздравляем!`, project.id);
    });

    res.json({ message: 'Проект успешно завершен!' });
  } catch (error) { res.status(500).json({ message: 'Ошибка завершения проекта' }); }
};