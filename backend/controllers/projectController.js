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
          { model: ProjectStage, include: [{ model: Task, include: [{ model: Attachment }, { model: User, as: 'pendingTransferUser', attributes: ['id','fullName'] }, { model: User, as: 'worker', attributes: ['id','fullName'] }] }] },
          { model: User, as: 'Users', attributes: ['id', 'fullName', 'email'], include: [{ model: Role }] }
        ]
      });
    } else {
      const user = await User.findByPk(id, {
        include: [{
          model: Project, as: 'Projects', 
          include: [
            { model: ProjectStage, include: [{ model: Task, include: [{ model: Attachment }, { model: User, as: 'pendingTransferUser', attributes: ['id','fullName'] }, { model: User, as: 'worker', attributes: ['id','fullName'] }] }] },
            { model: User, as: 'Users', attributes: ['id', 'fullName', 'email'], include: [{ model: Role }] }
          ]
        }]
      });
      projects = user.Projects;
    }
    res.json(projects);
  } catch (error) { res.status(500).json({ message: 'Ошибка получения проектов' }); }
};

export const createProject = async (req, res) => {
  try {
    const { name, description, startDate, plannedEndDate, userIds } = req.body;
    if (name.length > 150) return res.status(400).json({ message: 'Слишком длинное название проекта' });
    if (new Date(plannedEndDate) < new Date(startDate)) return res.status(400).json({ message: 'Конец проекта не может быть раньше начала' });
    
    if (!userIds || userIds.length === 0) {
      return res.status(400).json({ message: 'В проекте должен быть минимум 1 заказчик и 1 прораб' });
    }

    const users = await User.findAll({ where: { id: userIds }, include: [Role] });
    const hasClient = users.some(u => u.Role.name === 'Заказчик');
    const hasBuilder = users.some(u => u.Role.name === 'Прораб');

    if (!hasClient || !hasBuilder) {
      return res.status(400).json({ message: 'В проекте должен быть минимум 1 заказчик и 1 прораб' });
    }

    const project = await Project.create({ name, description, startDate, plannedEndDate });
    await project.setUsers(userIds);
    res.status(201).json({ message: 'Проект создан', project });
  } catch (error) { res.status(500).json({ message: 'Ошибка при создании проекта' }); }
};

export const updatePlanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { planStatus } = req.body; 
    const project = await Project.findByPk(id, { include: [{ model: User, as: 'Users', include: [Role] }] });
    if (!project) return res.status(404).json({ message: 'Проект не найден' });

    await project.update({ planStatus });
    const clients = project.Users.filter(u => u.Role.name === 'Заказчик');
    const builders = project.Users.filter(u => u.Role.name === 'Прораб');

    if (planStatus === 'pending_approval') {
      clients.forEach(c => sendNotification(c, `Прораб отправил план проекта "${project.name}" на утверждение.`, project.id));
    } else if (planStatus === 'approved') {
      builders.forEach(b => sendNotification(b, `Заказчик утвердил план проекта "${project.name}".`, project.id));
    } else if (planStatus === 'rejected') {
      builders.forEach(b => sendNotification(b, `Заказчик отклонил план проекта "${project.name}".`, project.id));
    }
    res.json({ message: `Статус плана изменен`, project });
  } catch (error) { res.status(500).json({ message: 'Ошибка' }); }
};

export const getProjectMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await Message.findAll({ where: { projectId: id }, include: [{ model: User, as: 'sender', attributes: ['id', 'fullName', 'roleId'] }], order: [['createdAt', 'ASC']] });
    res.json(messages);
  } catch (error) { res.status(500).json({ message: 'Ошибка' }); }
};

export const markMessagesRead = async (req, res) => {
  try {
    const { id } = req.params;
    const [updatedCount] = await Message.update({ isRead: true }, { where: { projectId: id, senderId: { [Op.ne]: req.user.id }, isRead: false } });
    if (updatedCount > 0) req.io.to(id).emit('messages_read', { readerId: req.user.id });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ message: 'Ошибка' }); }
};

export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, startDate, plannedEndDate, status, userIds } = req.body;
    if (name.length > 150) return res.status(400).json({ message: 'Слишком длинное название проекта' });
    if (new Date(plannedEndDate) < new Date(startDate)) return res.status(400).json({ message: 'Конец проекта не может быть раньше начала' });
    
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ message: 'Проект не найден' });

    if (userIds) {
      if (userIds.length === 0) return res.status(400).json({ message: 'В проекте должен быть минимум 1 заказчик и 1 прораб' });
      
      const newUsers = await User.findAll({ where: { id: userIds }, include: [Role] });
      const newBuilders = newUsers.filter(u => u.Role.name === 'Прораб');
      const hasClient = newUsers.some(u => u.Role.name === 'Заказчик');

      if (!hasClient || newBuilders.length === 0) {
        return res.status(400).json({ message: 'В проекте должен быть минимум 1 заказчик и 1 прораб' });
      }

      const oldUsers = await project.getUsers({ include: [Role] });
      const oldBuilders = oldUsers.filter(u => u.Role.name === 'Прораб');
      const removedBuilders = oldBuilders.filter(ob => !userIds.includes(ob.id));

      if (removedBuilders.length > 0) {
        const targetBuilderId = newBuilders[0].id;
        const stages = await ProjectStage.findAll({ where: { projectId: project.id } });
        const stageIds = stages.map(s => s.id);
        
        if (stageIds.length > 0) {
          for (const rb of removedBuilders) {
            await Task.update(
              { assignedUserId: targetBuilderId, transferToUserId: null },
              { where: { assignedUserId: rb.id, stageId: { [Op.in]: stageIds } } }
            );
          }
        }
      }
      await project.setUsers(userIds);
    }

    await project.update({ name, description, startDate, plannedEndDate, status });
    res.json({ message: 'Проект обновлен', project });
  } catch (error) { res.status(500).json({ message: 'Ошибка обновления' }); }
};

export const sendProjectMessage = async (req, res) => {
  try {
    const message = await Message.create({ text: req.body.text, projectId: req.params.id, senderId: req.user.id });
    const fullMessage = await Message.findByPk(message.id, { include: [{ model: User, as: 'sender', attributes: ['id', 'fullName', 'roleId'] }] });
    req.io.to(req.params.id).emit('message_broadcast', fullMessage);
    res.status(201).json(fullMessage);
  } catch (error) { res.status(500).json({ message: 'Ошибка' }); }
};

export const completeProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, { include: [{ model: User, as: 'Users' }] });
    project.status = 'completed';
    project.actualEndDate = new Date();
    await project.save();
    project.Users.forEach(u => sendNotification(u, `Проект "${project.name}" успешно завершен!`, project.id));
    res.json({ message: 'Проект завершен' });
  } catch (error) { res.status(500).json({ message: 'Ошибка' }); }
};