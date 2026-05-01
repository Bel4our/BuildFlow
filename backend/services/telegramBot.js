import TelegramBot from 'node-telegram-bot-api';
import { User, Project, ProjectStage, Task, Attachment, Role } from '../models/index.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

const planTranslations = { draft: 'Черновик', pending_approval: 'Ожидает утверждения', approved: 'Утвержден', rejected: 'Отклонен' };

if (token && token !== 'secret') {
  bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = match[1]; 
    try {
      const user = await User.findByPk(userId);
       if (user) {
        await User.update({ telegramId: null }, { where: { telegramId: chatId.toString() } });
        user.telegramId = chatId.toString();
        await user.save();
        bot.sendMessage(chatId, `Отлично, ${user.fullName}! Ваш аккаунт успешно привязан.\n\n/status - Узнать прогресс\n/settings - Настройки уведомлений`);
      }
    } catch (error) {}
  });

  bot.onText(/\/start$/, (msg) => { bot.sendMessage(msg.chat.id, 'Привяжите аккаунт через сайт BuildFlow.'); });

  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const user = await User.findOne({ where: { telegramId: chatId.toString() }, include: [{ model: Project, as: 'Projects', include: [{ model: ProjectStage, include: [{ model: Task }] }] }] });
      if (!user) return;
      if (!user.Projects || user.Projects.length === 0) return bot.sendMessage(chatId, 'Нет активных проектов.');

      let text = `*Сводка по проектам:*\n\n`;
      user.Projects.forEach(p => {
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
      const user = await User.findOne({ where: { telegramId: chatId.toString() }, include: [{ model: Project, as: 'Projects' }] });
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
        const user = await User.findOne({ where: { telegramId: chatId.toString() }, include: [{ model: Project, as: 'Projects' }] });
        if (!user) return;
        
        let settings = { global: true, mutedProjects: [] };
        if (user.tgSettings) { try { settings = JSON.parse(user.tgSettings); } catch(e){} }

        if (data === 'toggle_global') {
          settings.global = !settings.global;
        } else if (data.startsWith('toggle_proj_')) {
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

      if (data.startsWith('approve_') || data.startsWith('reject_')) {
        const stageId = data.split('_')[1];
        const stage = await ProjectStage.findByPk(stageId, { include: [{ model: Project, include: [{ model: User, as: 'Users', include: [Role] }] }, Task] });
        
        if (data.startsWith('approve_')) {
          if (stage.status === 'утверждено') return bot.answerCallbackQuery(query.id, { text: 'Уже утвержден', show_alert: true });
          stage.status = 'утверждено';
          stage.actualEndDate = new Date();
          await stage.save();
          bot.editMessageText(query.message.text + '\n\n*ВЫ УТВЕРДИЛИ ЭТОТ ЭТАП*', { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
          const builders = stage.Project.Users.filter(u => u.Role.name === 'Прораб');
          builders.forEach(b => sendNotification(b, `Заказчик утвердил этап *"${stage.name}"*!`, stage.Project.id, { parse_mode: 'Markdown' }));
          bot.answerCallbackQuery(query.id, { text: 'Утвержден!' });
        } else {
          stage.status = 'в работе';
          await stage.save();
          for (let task of stage.Tasks) { task.status = 'в работе'; await task.save(); }
          bot.editMessageText(query.message.text + '\n\n*ВЫ ОТКЛОНИЛИ ЭТОТ ЭТАП*', { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
          const builders = stage.Project.Users.filter(u => u.Role.name === 'Прораб');
          builders.forEach(b => sendNotification(b, `Заказчик *ОТКЛОНИЛ* этап "${stage.name}".`, stage.Project.id, { parse_mode: 'Markdown' }));
          bot.answerCallbackQuery(query.id, { text: 'Отклонен!' });
        }
      }

      if (data.startsWith('files_')) {
        const stageId = data.split('_')[1];
        bot.answerCallbackQuery(query.id, { text: 'Собираю файлы...' });
        const stage = await ProjectStage.findByPk(stageId, { include: [{ model: Task, include: [Attachment] }] });
        const allAttachments = stage.Tasks.flatMap(t => t.Attachments);
        if (allAttachments.length === 0) return bot.sendMessage(chatId, 'Файлов нет.');
        for (const att of allAttachments) {
          const filePath = path.join(process.cwd(), att.filePath);
          if (fs.existsSync(filePath)) await bot.sendDocument(chatId, fs.createReadStream(filePath));
        }
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

export default bot;