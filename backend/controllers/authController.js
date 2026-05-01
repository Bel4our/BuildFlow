import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, Role } from '../models/index.js';

const passRegex = /^(?=.*[a-zA-Zа-яА-Я])(?=.*\d)(?=.*[^a-zA-Zа-яА-Я0-9]).{8,}$/;

export const register = async (req, res) => {
  try {
    const { email, password, fullName, roleName } = req.body;
    if (!email || !password || !fullName || !roleName) return res.status(400).json({ message: 'Все поля обязательны' });
    if (!['Заказчик', 'Прораб'].includes(roleName)) return res.status(403).json({ message: 'Недопустимая роль' });
    if (!passRegex.test(password)) return res.status(400).json({ message: 'Пароль: мин. 8 символов, 1 буква, 1 цифра, 1 спецсимвол' });

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'Email уже существует' });

    const role = await Role.findOne({ where: { name: roleName } });
    if (!role) return res.status(500).json({ message: 'Роль не найдена' });

    const hashPassword = await bcrypt.hash(password, 10);
    await User.create({ email, passwordHash: hashPassword, fullName: fullName.substring(0,100), roleId: role.id });
    res.status(201).json({ message: 'Регистрация успешна' });
  } catch (error) { res.status(500).json({ message: 'Ошибка сервера' }); }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email }, include: Role });
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
    if (user.status === 'blocked') return res.status(403).json({ message: 'Ваш аккаунт заблокирован' });

    const isPassValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPassValid) return res.status(400).json({ message: 'Неверный пароль' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.Role.name, fullName: user.fullName, hasTelegram: !!user.telegramId }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, role: user.Role.name, fullName: user.fullName } });
  } catch (error) { res.status(500).json({ message: 'Ошибка при входе' }); }
};

export const updateProfile = async (req, res) => {
  try {
    const { fullName, email, currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findByPk(req.user.id, { include: Role });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Неверный текущий пароль' });

    if (newPassword) {
      if (newPassword !== confirmPassword) return res.status(400).json({ message: 'Новые пароли не совпадают' });
      if (!passRegex.test(newPassword)) return res.status(400).json({ message: 'Новый пароль: мин. 8 символов, 1 буква, 1 цифра, 1 спецсимвол' });
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ where: { email } });
      if (emailExists) return res.status(400).json({ message: 'Этот Email уже занят' });
      user.email = email;
    }

    user.fullName = fullName ? fullName.substring(0,100) : user.fullName;
    await user.save();

    const token = jwt.sign({ id: user.id, email: user.email, role: user.Role.name, fullName: user.fullName, hasTelegram: !!user.telegramId }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Профиль обновлен', token });
  } catch (error) { res.status(500).json({ message: 'Ошибка сервера' }); }
};

export const disconnectTelegram = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { include: Role });
    user.telegramId = null;
    await user.save();
    const token = jwt.sign({ id: user.id, email: user.email, role: user.Role.name, fullName: user.fullName, hasTelegram: false }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Telegram отключен', token });
  } catch (error) { res.status(500).json({ message: 'Ошибка' }); }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
    res.json({ id: user.id, email: user.email, fullName: user.fullName, hasTelegram: !!user.telegramId });
  } catch (error) { res.status(500).json({ message: 'Ошибка' }); }
};