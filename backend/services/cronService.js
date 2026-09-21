import { ProjectStage, Project, User, Role } from '../models/index.js';
import { Op } from 'sequelize';
import { sendNotification } from './telegramBot.js';
import { ROLES } from '../utils/constants.js';

export const checkOverdueStages = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const justOverdueStages = await ProjectStage.findAll({
      where: { 
        status: { [Op.ne]: 'утверждено' },
        plannedEndDate: {
          [Op.gte]: yesterday,
          [Op.lt]: today
        }
      },
      include: [{ 
        model: Project, 
        where: { status: { [Op.ne]: 'completed' } },
        include: [{ model: User, as: 'Users', include: [Role] }] 
      }]
    });

    for (const stage of justOverdueStages) {
      const targetUsers = stage.Project.Users.filter(u => 
        u.Role.name === ROLES.CLIENT || u.Role.name === ROLES.BUILDER
      );
      
      targetUsers.forEach(u => {
        const rolePrefix = u.Role.name === ROLES.CLIENT ? 'Уважаемый Заказчик' : 'Внимание, Прораб';
        sendNotification(
          u, 
          `${rolePrefix}! Этап "${stage.name}" в проекте "${stage.Project.name}" был просрочен. Дедлайн был: ${new Date(stage.plannedEndDate).toLocaleDateString('ru-RU')}.`, 
          stage.Project.id
        );
      });
    }
  } catch (e) {}
};