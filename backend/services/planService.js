import { Project, User, Role } from '../models/index.js';
import { broadcastToProject } from './telegramBot.js';

export const triggerReapproval = async (projectId) => {
  const project = await Project.findByPk(projectId, { include: [{ model: User, as: 'Users', include: [Role] }] });
  if (!project) return;

  if (project.planStatus === 'approved') {
    project.planStatus = 'pending_approval';
    await project.save();
    broadcastToProject(
      projectId,
      ['Заказчик'],
      `В проекте «${project.name}» есть изменения в структуре плана. План отправлен повторно на утверждение.`,
    );
  }
};