import { Project, User, Role } from '../models/index.js';
import { broadcastToProject } from './telegramBot.js';

export const triggerReapproval = async (projectId, actionText) => {
  const project = await Project.findByPk(projectId, { include: [{ model: User, as: 'Users', include: [Role] }] });
  if (!project) return;

  if (project.planStatus === 'approved') {
    project.planStatus = 'pending_approval';
    await project.save();
    
    broadcastToProject(projectId, ['Заказчик'], `⚠️ Прораб внес изменения в план проекта "${project.name}" (${actionText}). План снова отправлен вам на утверждение.`);
  }
};