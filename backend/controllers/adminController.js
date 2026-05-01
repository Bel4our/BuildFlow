import { User, Role } from '../models/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';

const passRegex = /^(?=.*[a-zA-Zа-яА-Я])(?=.*\d)(?=.*[^a-zA-Zа-яА-Я0-9]).{8,}$/;

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({ include: Role, attributes: { exclude: ['passwordHash'] } });
    res.json(users);
  } catch (error) { res.status(500).json({ message: 'Ошибка получения пользователей' }); }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === parseInt(id)) return res.status(403).json({ message: 'Нельзя заблокировать самого себя' });
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
    const newStatus = user.status === 'active' ? 'blocked' : 'active';
    await user.update({ status: newStatus });
    res.json({ message: `Статус пользователя изменен на ${newStatus}` });
  } catch (error) { res.status(500).json({ message: 'Ошибка' }); }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === parseInt(id)) return res.status(403).json({ message: 'Нельзя удалить самого себя' });
    await User.destroy({ where: { id } });
    res.json({ message: 'Пользователь удален' });
  } catch (error) { res.status(500).json({ message: 'Ошибка' }); }
};

export const updateUserInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, roleId } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'Не найден' });
    
    if (req.user.id === parseInt(id) && user.roleId !== parseInt(roleId)) {
      return res.status(403).json({ message: 'Нельзя изменить собственную роль' });
    }

    const existingEmail = await User.findOne({ where: { email, id: { [Op.ne]: id } } });
    if (existingEmail) return res.status(400).json({ message: 'Этот Email уже занят другим пользователем' });
    
    await User.update({ fullName: fullName.substring(0,100), email, roleId }, { where: { id } });

    let newToken = null;
    if (req.user.id === parseInt(id)) {
      const updatedUser = await User.findByPk(id, { include: Role });
      newToken = jwt.sign(
        { id: updatedUser.id, email: updatedUser.email, role: updatedUser.Role.name, fullName: updatedUser.fullName, hasTelegram: !!updatedUser.telegramId }, 
        process.env.JWT_SECRET, 
        { expiresIn: '24h' }
      );
    }

    res.json({ message: 'Данные пользователя обновлены', token: newToken });
  } catch (error) { res.status(500).json({ message: 'Ошибка обновления' }); }
};

export const createUser = async (req, res) => {
  try {
    const { fullName, email, password, roleId } = req.body;
    if (!passRegex.test(password)) return res.status(400).json({ message: 'Пароль: мин. 8 символов, 1 буква, 1 цифра, 1 спецсимвол' });
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'Email уже существует' });
    const hashPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ email, passwordHash: hashPassword, fullName: fullName.substring(0,100), roleId });
    res.status(201).json({ message: 'Пользователь создан', user: newUser });
  } catch (error) { res.status(500).json({ message: 'Ошибка' }); }
};