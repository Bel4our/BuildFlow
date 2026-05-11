import TelegramBot from 'node-telegram-bot-api';
import { User, Project, ProjectStage, Task, Attachment, Role } from '../models/index.js';
import { Op } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

const planTranslations = { draft: 'Черновик', pending_approval: 'Ожидает утверждения', approved: 'Утвержден', rejected: 'Отклонен' };

if (token && token !== 'secret') {
  bot = new TelegramBot(token, { polling: true });

  const setRegularUserCommands = async (chatId) => {
    await bot.setMyCommands([
      { command: '/status', description: '📊 Прогресс (можно указать имя проекта)' },
      { command: '/settings', description: '⚙️ Настройки уведомлений' }
    ], { scope: { type: 'chat', chat_id: chatId } });
  };

  const setAdminCommands = async (chatId) => {
    await bot.setMyCommands([
      { command: '/projects', description: '📁 Список/поиск проектов' },
      { command: '/users', description: '👥 Список/поиск пользователей' }
    ], { scope: { type: 'chat', chat_id: chatId } });
  };

  bot.onText(/\/start (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = match[1]; 
    try {
      const user = await User.findByPk(userId, { include: [Role] });
       if (user && user.status !== 'deleted') {
        await User.update({ telegramId: null }, { where: { telegramId: chatId.toString() } });
        user.telegramId = chatId.toString();
        await user.save();
        
        let text = `Отлично, ${user.fullName}! Ваш аккаунт успешно привязан.\nВаша роль: *${user.Role.name}*.\n\n`;
        if (user.Role.name === 'Администратор') {
          await setAdminCommands(chatId);
          text += `Вам доступны команды для поиска:\n/projects [название]\n/users [имя/email]`;
        } else {
          await setRegularUserCommands(chatId);
          text += `Используйте меню команд для навигации.`;
        }
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
    } catch (error) {}
  });

  bot.onText(/\/start$/, async (msg) => { 
    const chatId = msg.chat.id;
    try {
      const user = await User.findOne({ where: { telegramId: chatId.toString(), status: { [Op.ne]: 'deleted' } } });
      if (user) {
        bot.sendMessage(chatId, '✅ Ваш аккаунт уже привязан к боту. Используйте меню команд для работы.');
      } else {
        bot.sendMessage(chatId, '🔗 Вы не авторизованы. Пожалуйста, привяжите аккаунт через раздел "Личный кабинет" на сайте BuildFlow.');
      }
    } catch (e) {}
  });

  bot.onText(/\/projects(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const searchQuery = match[1];
    try {
      const user = await User.findOne({ where: { telegramId: chatId.toString(), status: { [Op.ne]: 'deleted' } }, include: [Role] });
      if (!user || user.Role.name !== 'Администратор') return bot.sendMessage(chatId, '❌ Эта команда доступна только администраторам.');
      
      let whereClause = {};
      if (searchQuery) {
        whereClause = { name: { [Op.like]: `%${searchQuery}%` } };
      }

      const projects = await Project.findAll({ where: whereClause, limit: 10, order: [['createdAt', 'DESC']] });
      if (projects.length === 0) return bot.sendMessage(chatId, searchQuery ? 'Проекты по вашему запросу не найдены.' : 'Проектов нет.');
      
      let text = searchQuery ? `*Результаты поиска по "${searchQuery}" (${projects.length}):*\n\n` : '*Последние 10 проектов в системе:*\n\n';
      projects.forEach(p => {
        text += `🔹 *${p.name}*\nСтатус: ${p.status === 'active' ? 'В работе' : p.status === 'completed' ? 'Завершен' : 'Отменен'}\n\n`;
      });
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (error) {}
  });

  bot.onText(/\/users(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const searchQuery = match[1];
    try {
      const user = await User.findOne({ where: { telegramId: chatId.toString(), status: { [Op.ne]: 'deleted' } }, include: [Role] });
      if (!user || user.Role.name !== 'Администратор') return bot.sendMessage(chatId, '❌ Эта команда доступна только администраторам.');
      
      let whereClause = { status: { [Op.ne]: 'deleted' } };
      if (searchQuery) {
        whereClause = {
          ...whereClause,
          [Op.or]: [
            { fullName: { [Op.like]: `%${searchQuery}%` } },
            { email: { [Op.like]: `%${searchQuery}%` } }
          ]
        };
      }

      const usersList = await User.findAll({ where: whereClause, include: [Role], limit: 10, order: [['id', 'DESC']] });
      if (usersList.length === 0) return bot.sendMessage(chatId, searchQuery ? 'Пользователи по вашему запросу не найдены.' : 'Пользователей нет.');

      let text = searchQuery ? `*Результаты поиска по "${searchQuery}" (${usersList.length}):*\n\n` : '*Последние 10 пользователей:*\n\n';
      usersList.forEach(u => {
        text += `👤 ${u.fullName} - _${u.Role.name}_\n`;
      });
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (error) {}
  });

  bot.onText(/\/status(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const searchQuery = match[1]?.trim();

    try {
      const user = await User.findOne({ where: { telegramId: chatId.toString(), status: { [Op.ne]: 'deleted' } }, include: [{ model: Project, as: 'Projects', include: [{ model: ProjectStage, include: [{ model: Task }] }] }] });
      if (!user) return;
      if (!user.Projects || user.Projects.length === 0) return bot.sendMessage(chatId, 'Нет активных проектов.');

      let targetProjects = user.Projects;
      
      if (searchQuery) {
        targetProjects = targetProjects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (targetProjects.length === 0) {
          return bot.sendMessage(chatId, `❌ Проекты, содержащие в названии "${searchQuery}", не найдены.`);
        }
      }

      let text = searchQuery ? `*Результаты поиска по вашим проектам ("${searchQuery}"):*\n\n` : `*Сводка по вашим проектам:*\n\n`;
      
      targetProjects.forEach(p => {
        const allTasks = p.ProjectStages.flatMap(s => s.Tasks);
        const completed = allTasks.filter(t => t.status === 'выполнена').length;
        const progress = allTasks.length === 0 ? 0 : Math.round((completed / allTasks.length) * 100);
        text += `*${p.name}*\nСтатус плана: ${planTranslations[p.planStatus] || p.planStatus}\nПрогресс: ${progress}% (${completed}/${allTasks.length})\n\n`;
      });
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (error) {}
  });

  bot.onText(/\/settings/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const user = await User.findOne({ where: { telegramId: chatId.toString(), status: { [Op.ne]: 'deleted' } }, include: [{ model: Project, as: 'Projects' }] });
      if (!user) return;
      
      let settings = { global: true, mutedProjects: [] };
      if (user.tgSettings) { try { settings = JSON.parse(user.tgSettings); } catch(e){} }

      const keyboard = [[{ text: settings.global ? '🔕 Выключить ВСЕ уведомления' : '🔔 Включить ВСЕ уведомления', callback_data: 'toggle_global' }]];

      if (settings.global) {
        user.Projects.forEach(p => {
          const isMuted = settings.mutedProjects.includes(p.id);
          keyboard.push([{ text: `${isMuted ? '❌' : '✅'} ${p.name}`, callback_data: `toggle_proj_${p.id}` }]);
        });
      }

      bot.sendMessage(chatId, 'Настройки уведомлений (✅ - включены, ❌ - выключены):', { reply_markup: { inline_keyboard: keyboard } });
    } catch (error) {}
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data; 

    try {
      if (data.startsWith('toggle_')) {
        const user = await User.findOne({ where: { telegramId: chatId.toString(), status: { [Op.ne]: 'deleted' } }, include: [{ model: Project, as: 'Projects' }] });
        if (!user) return;
        
        let settings = { global: true, mutedProjects: [] };
        if (user.tgSettings) { try { settings = JSON.parse(user.tgSettings); } catch(e){} }

        if (data === 'toggle_global') settings.global = !settings.global;
        else if (data.startsWith('toggle_proj_')) {
          const pid = parseInt(data.replace('toggle_proj_', ''));
          if (settings.mutedProjects.includes(pid)) {
            settings.mutedProjects = settings.mutedProjects.filter(id => id !== pid);
          } else {
            settings.mutedProjects.push(pid);
          }
        }
        
        user.tgSettings = JSON.stringify(settings);
        await user.save();

        const keyboard = [[{ text: settings.global ? '🔕 Выключить ВСЕ уведомления' : '🔔 Включить ВСЕ уведомления', callback_data: 'toggle_global' }]];
        
        if (settings.global) {
          user.Projects.forEach(p => {
            const isMuted = settings.mutedProjects.includes(p.id);
            keyboard.push([{ text: `${isMuted ? '❌' : '✅'} ${p.name}`, callback_data: `toggle_proj_${p.id}` }]);
          });
        }

        bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, { chat_id: chatId, message_id: query.message.message_id });
        return bot.answerCallbackQuery(query.id);
      }
    } catch (error) {
      bot.answerCallbackQuery(query.id);
    }
  });
}

export const sendNotification = (userObj, text, projectId = null, options = {}) => {
  if (!bot || !userObj || !userObj.telegramId) return;
  try {
    let settings = { global: true, mutedProjects: [] };
    if (userObj.tgSettings) {
      try { settings = JSON.parse(userObj.tgSettings); } catch(e){}
    }
    if (!settings.global) return;
    if (projectId && settings.mutedProjects.includes(parseInt(projectId))) return;
    bot.sendMessage(userObj.telegramId, text, options);
  } catch (e) {}
};

export const broadcastToProject = async (projectId, rolesToNotify, text, options = {}) => {
  try {
    const project = await Project.findByPk(projectId, { include: [{ model: User, as: 'Users', include: [Role] }] });
    if (!project) return;
    const recipients = new Map();
    project.Users.forEach(u => {
      if (rolesToNotify.includes(u.Role.name)) recipients.set(u.id, u);
    });
    recipients.forEach(userObj => sendNotification(userObj, text, projectId, options));
  } catch (error) {}
};

export default bot;