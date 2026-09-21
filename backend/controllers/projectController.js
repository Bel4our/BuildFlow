import { Project, ProjectStage, User, Task, Attachment, Role, Message } from '../models/index.js';
import { Op } from 'sequelize';
import { broadcastToProject } from '../services/telegramBot.js';
import { ROLES, PLAN_STATUSES } from '../utils/constants.js';

/** Проверка списка участников после загрузки из БД. uniqueIds — уникальные id из запроса. */
function validateProjectParticipants(users, uniqueIds, res) {
  if (!uniqueIds.length) {
    res.status(400).json({
      message: 'Выберите на проект хотя бы одного заказчика и хотя бы одного прораба.',
    });
    return false;
  }
  if (users.length !== uniqueIds.length) {
    res.status(400).json({
      message: 'Некоторые выбранные пользователи не найдены или недоступны.',
    });
    return false;
  }
  const clients = users.filter((u) => u.Role?.name === ROLES.CLIENT);
  const builders = users.filter((u) => u.Role?.name === ROLES.BUILDER);

  if (!clients.length && !builders.length) {
    res.status(400).json({
      message:
        'Среди выбранных нет ни заказчиков, ни прорабов. Назначьте хотя бы одного пользователя каждой роли.',
    });
    return false;
  }
  if (!clients.length) {
    res.status(400).json({ message: 'Нужно назначить хотя бы одного заказчика.' });
    return false;
  }
  if (!builders.length) {
    res.status(400).json({ message: 'Нужно назначить хотя бы одного прораба.' });
    return false;
  }
  if (clients.length > 10 || builders.length > 10) {
    res.status(400).json({
      message:
        'На один проект можно назначить не более 10 заказчиков и не более 10 прорабов.',
    });
    return false;
  }
  return true;
}

export const getProjects = async (req, res) => {
  try {
    const { role, id } = req.user;
    let projects = role === ROLES.ADMIN ? 
      await Project.findAll({ include: [{ model: ProjectStage, include: [{ model: Task, include: [Attachment, { model: User, as: 'worker' }, { model: User, as: 'pendingTransferUser' }] }] }, { model: User, as: 'Users', include: [Role] }] }) :
      (await User.findByPk(id, { include: [{ model: Project, as: 'Projects', include: [{ model: ProjectStage, include: [{ model: Task, include: [Attachment, { model: User, as: 'worker' }, { model: User, as: 'pendingTransferUser' }] }] }, { model: User, as: 'Users', include: [Role] }] }] })).Projects;
    res.json(projects);
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const createProject = async (req, res) => {
  try {
    const { name, description, startDate, plannedEndDate, userIds } = req.body;
    if (new Date(plannedEndDate) < new Date(startDate)) {
      return res.status(400).json({ message: 'Дата окончания не может быть раньше даты начала.' });
    }
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ message: 'Не передан список участников проекта.' });
    }

    const uniqueIds = [...new Set(userIds)];
    const users = await User.findAll({ where: { id: uniqueIds }, include: [Role] });

    if (!validateProjectParticipants(users, uniqueIds, res)) return;

    const project = await Project.create({ name, description, startDate, plannedEndDate });
    await project.setUsers(uniqueIds);
    broadcastToProject(project.id, [ROLES.CLIENT, ROLES.BUILDER], `Вы назначены на новый проект: "${project.name}"`);
    res.status(201).json(project);
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const updatePlanStatus = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { planStatus } = req.body;

    if (planStatus === PLAN_STATUSES.PENDING) {
      const projectWithStages = await Project.findByPk(projectId, {
        include: [{ model: ProjectStage, include: [Task] }]
      });

      for (const stage of projectWithStages.ProjectStages) {
        if (stage.Tasks.length === 0) {
          return res.status(400).json({ message: `Этап "${stage.name}" не может быть пустым. Добавьте в него хотя бы одну задачу.` });
        }
        if (stage.Tasks.length > 50) {
          return res.status(400).json({ message: `В этапе "${stage.name}" слишком много задач (максимум 50).` });
        }
      }
    }
    
    const project = await Project.findByPk(projectId);
    await project.update({ planStatus });

    if (planStatus === PLAN_STATUSES.PENDING) broadcastToProject(projectId, [ROLES.CLIENT], `По проекту «${project.name}» есть изменения в плане. Требуется ваша проверка.`);
    else if (planStatus === PLAN_STATUSES.APPROVED) broadcastToProject(projectId, [ROLES.BUILDER], `План проекта "${project.name}" утвержден.`);
    else if (planStatus === PLAN_STATUSES.REJECTED) broadcastToProject(projectId, [ROLES.BUILDER], `План проекта "${project.name}" отклонен.`);
    
    req.io.to(projectId.toString()).emit('stage_status_updated');
    res.json(project);
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const updateProject = async (req, res) => {
  try {
    const { name, description, startDate, plannedEndDate, status, userIds } = req.body;
    const project = await Project.findByPk(req.params.id, { include: [{ model: User, as: 'Users', include: [Role] }] });
    
    if (project.planStatus === PLAN_STATUSES.APPROVED && (new Date(startDate).getTime() !== new Date(project.startDate).getTime() || new Date(plannedEndDate).getTime() !== new Date(project.plannedEndDate).getTime())) {
      return res.status(400).json({ message: 'Нельзя изменять даты проекта с утвержденным планом.' });
    }

    if (status === 'cancelled' && project.status !== 'cancelled') {
      const stages = await ProjectStage.findAll({ where: { projectId: project.id } });
      const stageIds = stages.map(s => s.id);
      if (stageIds.length > 0) {
        await Task.update(
          { status: 'отменена', transferToUserId: null },
          { where: { stageId: { [Op.in]: stageIds }, status: { [Op.ne]: 'выполнена' } } }
        );
      }
    }

    if (userIds !== undefined && userIds !== null) {
      if (!Array.isArray(userIds)) {
        return res.status(400).json({ message: 'Некорректный список участников проекта.' });
      }
      const uniqueIds = [...new Set(userIds)];
      const users = await User.findAll({ where: { id: uniqueIds }, include: [Role] });

      if (!validateProjectParticipants(users, uniqueIds, res)) return;

      const clients = users.filter((u) => u.Role?.name === ROLES.CLIENT);
      const builders = users.filter((u) => u.Role?.name === ROLES.BUILDER);
      const oldBuilders = project.Users.filter(u => u.Role.name === ROLES.BUILDER);
      const removed = oldBuilders.filter(ob => !uniqueIds.includes(ob.id));
      if (removed.length > 0) {
        const stages = await ProjectStage.findAll({ where: { projectId: project.id } });
        const sIds = stages.map(s => s.id);
        for (const rb of removed) {
          const count = await Task.count({ where: { assignedUserId: rb.id, stageId: { [Op.in]: sIds }, status: { [Op.ne]: 'выполнена' } } });
          if (count > 0) return res.status(400).json({ message: `У ${rb.fullName} есть активные задачи` });
        }
        await Task.update({ assignedUserId: builders[0].id, transferToUserId: null }, { where: { assignedUserId: { [Op.in]: removed.map(r=>r.id) }, stageId: { [Op.in]: sIds } } });
      }
      await project.setUsers(uniqueIds);
    }
    await project.update({ name, description, startDate, plannedEndDate, status });
    
    req.io.to(project.id.toString()).emit('stage_status_updated');
    res.json(project);
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Проект не найден' });
    await project.destroy();
    res.json({ message: 'Deleted' });
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const getProjectMessages = async (req, res) => {
  try { res.json(await Message.findAll({ where: { projectId: req.params.id }, include: [{ model: User, as: 'sender', attributes: ['id', 'fullName', 'roleId'] }], order: [['createdAt', 'ASC']] })); } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const markMessagesRead = async (req, res) => {
  try { 
    await Message.update({ isRead: true }, { where: { projectId: req.params.id, senderId: { [Op.ne]: req.user.id }, isRead: false } }); 
    req.io.to(req.params.id).emit('messages_read', { readerId: req.user.id });
    res.json({ success: true }); 
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const sendProjectMessage = async (req, res) => {
  try {
    const message = await Message.create({ text: req.body.text, projectId: req.params.id, senderId: req.user.id });
    const f = await Message.findByPk(message.id, { include: [{ model: User, as: 'sender', attributes: ['id', 'fullName', 'roleId'] }] });
    req.io.to(req.params.id).emit('message_broadcast', f); res.status(201).json(f);
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const completeProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [{ model: ProjectStage, include: [Task] }],
    });
    if (!project) return res.status(404).json({ message: 'Проект не найден' });

    if (project.status !== 'active') {
      return res.status(400).json({ message: 'Завершить можно только активный проект.' });
    }
    if (project.planStatus !== PLAN_STATUSES.APPROVED) {
      return res.status(400).json({ message: 'План должен быть утверждён перед приёмкой готового объекта.' });
    }

    const stages = project.ProjectStages || [];
    for (const stage of stages) {
      if (stage.status !== 'утверждено') {
        return res.status(400).json({
          message: `Нельзя завершить проект: этап «${stage.name}» не утверждён заказчиком.`,
        });
      }
      const relevant = (stage.Tasks || []).filter((t) => t.status !== 'отменена');
      if (relevant.length === 0 || !relevant.every((t) => t.status === 'выполнена')) {
        return res.status(400).json({
          message: `Нельзя завершить проект: в этапе «${stage.name}» есть незавершённые задачи.`,
        });
      }
    }

    project.status = 'completed';
    project.actualEndDate = new Date();
    await project.save();
    broadcastToProject(project.id, [ROLES.CLIENT, ROLES.BUILDER], `Проект "${project.name}" завершен.`);

    req.io.to(project.id.toString()).emit('stage_status_updated');
    res.json({ message: 'Success' });
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
};