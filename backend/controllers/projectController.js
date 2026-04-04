import { Project, ProjectStage, User, Task, Attachment, Role, Message } from '../models/index.js';
import { Op } from 'sequelize';

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
    console.error("Ошибка в getProjects:", error);
    res.status(500).json({ message: 'Ошибка получения проектов', error: error.message });
  }
};


export const createProject = async (req, res) => {
  try {
    const { name, description, startDate, plannedEndDate, userIds } = req.body;
    
    const project = await Project.create({ name, description, startDate, plannedEndDate });
    
    if (userIds && userIds.length > 0) {
      await project.setUsers(userIds);
    }

    res.status(201).json({ message: 'Каркас проекта создан. Ожидание плана от прораба.', project });
  } catch (error) {
    console.error("Ошибка в createProject:", error);
    res.status(500).json({ message: 'Ошибка при создании проекта', error: error.message });
  }
};





export const updatePlanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { planStatus } = req.body; 
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ message: 'Проект не найден' });

    await project.update({ planStatus });
    res.json({ message: `Статус плана изменен на ${planStatus}`, project });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка изменения статуса плана' });
  }
};


export const getProjectMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await Message.update(
      { isRead: true },
      { where: { projectId: id, senderId: { [Op.ne]: userId }, isRead: false } }
    );

    const messages = await Message.findAll({
      where: { projectId: id },
      include: [{ model: User, as: 'sender', attributes: ['fullName', 'roleId'] }],
      order: [['createdAt', 'ASC']]
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка загрузки чата' });
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
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка отправки сообщения' });
  }
};