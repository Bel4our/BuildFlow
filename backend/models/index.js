import bcrypt from 'bcrypt';
import sequelize from '../config/db.js';
import User from './User.js';
import Role from './Role.js';
import Project from './Project.js';
import Task from './Task.js';
import Service from './Service.js';
import ProjectStage from './ProjectStage.js';
import Attachment from './Attachment.js';
import Message from './Message.js';

Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { foreignKey: 'roleId' });

const ProjectUsers = sequelize.define('ProjectUsers', {}, { timestamps: false });
Project.belongsToMany(User, { as: 'Users', through: ProjectUsers, foreignKey: 'projectId' });
User.belongsToMany(Project, { as: 'Projects', through: ProjectUsers, foreignKey: 'userId' });

Project.hasMany(ProjectStage, { foreignKey: 'projectId', onDelete: 'CASCADE' });
ProjectStage.belongsTo(Project, { foreignKey: 'projectId' });

ProjectStage.hasMany(Task, { foreignKey: 'stageId', onDelete: 'CASCADE' });
Task.belongsTo(ProjectStage, { foreignKey: 'stageId' });

User.hasMany(Task, { foreignKey: 'assignedUserId' });
Task.belongsTo(User, { foreignKey: 'assignedUserId', as: 'worker' });

User.hasMany(Task, { foreignKey: 'transferToUserId', as: 'transferRequests' });
Task.belongsTo(User, { foreignKey: 'transferToUserId', as: 'pendingTransferUser' });

Task.hasMany(Attachment, { foreignKey: 'taskId', onDelete: 'CASCADE' });
Attachment.belongsTo(Task, { foreignKey: 'taskId' });

User.hasMany(Attachment, { foreignKey: 'uploadedByUserId' });
Attachment.belongsTo(User, { foreignKey: 'uploadedByUserId', as: 'uploader' });

Project.hasMany(Message, { foreignKey: 'projectId', onDelete: 'CASCADE' });
Message.belongsTo(Project, { foreignKey: 'projectId' });

User.hasMany(Message, { foreignKey: 'senderId' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

const seedDatabase = async () => {
  try {
    const roles = ['Гость', 'Заказчик', 'Прораб', 'Администратор'];
    for (const roleName of roles) {
      await Role.findOrCreate({ where: { name: roleName } });
    }

    const adminRole = await Role.findOne({ where: { name: 'Администратор' } });
    const existingAdmin = await User.findOne({ where: { email: 'admin@build.com' } });
    
    if (!existingAdmin && adminRole) {
      const hashPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        email: 'admin@build.com',
        passwordHash: hashPassword,
        fullName: 'Главный Администратор',
        roleId: adminRole.id,
        status: 'active'
      });
    }

    const servicesCount = await Service.count();
    if (servicesCount === 0) {
      await Service.bulkCreate([
        { name: 'Строительство домов "под ключ"', description: 'Полный цикл строительства от фундамента до крыши.' },
        { name: 'Внутренняя отделка', description: 'Ремонт помещений, малярные и штукатурные работы.' },
        { name: 'Проектирование', description: 'Создание архитектурных и инженерных проектов.' }
      ]);
    }

  } catch (error) {}
};

export { sequelize, User, Role, Project, Task, Service, ProjectStage, Attachment, ProjectUsers, Message, seedDatabase };