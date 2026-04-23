import { User, Role } from '../models/index.js';
import bcrypt from 'bcrypt';

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({ 
      include: Role, 
      attributes: { exclude: ['passwordHash'] }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения пользователей' });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === parseInt(id)) {
      return res.status(403).json({ message: 'Нельзя заблокировать самого себя' });
    }
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    const newStatus = user.status === 'active' ? 'blocked' : 'active';
    await user.update({ status: newStatus });
    res.json({ message: `Статус пользователя изменен на ${newStatus}` });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка изменения статуса' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === parseInt(id)) {
      return res.status(403).json({ message: 'Нельзя удалить самого себя' });
    }
    await User.destroy({ where: { id } });
    res.json({ message: 'Пользователь удален' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка удаления' });
  }
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

    await User.update({ fullName, email, roleId }, { where: { id } });
    res.json({ message: 'Данные пользователя обновлены' });
  } catch (error) { res.status(500).json({ message: 'Ошибка' }); }
};

export const createUser = async (req, res) => {
  try {
    const { fullName, email, password, roleId } = req.body;
    
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'Пользователь с таким email уже существует' });

    const hashPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ email, passwordHash: hashPassword, fullName, roleId });
    
    res.status(201).json({ message: 'Пользователь создан', user: newUser });
  } catch (error) { res.status(500).json({ message: 'Ошибка создания пользователя' }); }
};