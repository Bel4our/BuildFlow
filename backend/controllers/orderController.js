import { ProjectStage, Task, Project, User, Role } from '../models/index.js';
import sequelize from '../config/db.js';
import { sendNotification } from '../services/telegramBot.js';

const triggerReapproval = async (projectId, actionText) => {
  const project = await Project.findByPk(projectId, { include: [{ model: User, as: 'Users', include: [Role] }] });
  if (project && project.planStatus === 'approved') {
    project.planStatus = 'pending_approval';
    await project.save();
    const clients = project.Users.filter(u => u.Role.name === 'Заказчик');
    clients.forEach(c => sendNotification(c, `Прораб изменил план проекта "${project.name}" (${actionText}). План возвращен на утверждение.`, project.id));
  }
};

export const updateStageOrder = async (req, res) => {
  const { orderedStageIds } = req.body;
  const { projectId } = req.params;
  const t = await sequelize.transaction();
  try {
    for (let i = 0; i < orderedStageIds.length; i++) {
      await ProjectStage.update(
        { order: i },
        { where: { id: orderedStageIds[i], projectId: projectId }, transaction: t }
      );
    }
    await t.commit();
    await triggerReapproval(projectId, 'изменен порядок этапов');
    res.json({ message: 'Порядок этапов обновлен' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: 'Ошибка обновления порядка этапов' });
  }
};

export const updateTaskOrder = async (req, res) => {
  const { orderedTaskIds } = req.body;
  const { stageId } = req.params;
  const t = await sequelize.transaction();
  try {
    for (let i = 0; i < orderedTaskIds.length; i++) {
      await Task.update(
        { order: i },
        { where: { id: orderedTaskIds[i], stageId: stageId }, transaction: t }
      );
    }
    await t.commit();
    const stage = await ProjectStage.findByPk(stageId);
    if (stage) {
      await triggerReapproval(stage.projectId, 'изменен порядок задач');
    }
    res.json({ message: 'Порядок задач обновлен' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: 'Ошибка обновления порядка задач' });
  }
};