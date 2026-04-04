import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, Role } from '../models/index.js';

export const register = async (req, res) => {
  try {
    const { email, password, fullName, roleName } = req.body;

    if (!email || !password || !fullName || !roleName) {
      return res.status(400).json({ message: 'Все поля обязательны для заполнения' });
    }

    if (!['Заказчик', 'Прораб'].includes(roleName)) {
      return res.status(403).json({ message: 'Выбрана недопустимая роль' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'Пользователь с таким email уже существует' });

    const role = await Role.findOne({ where: { name: roleName } });
    if (!role) return res.status(500).json({ message: 'Ошибка: Роль не найдена в базе' });

    const hashPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email, 
      passwordHash: hashPassword, 
      fullName, 
      roleId: role.id, 
    });

    res.status(201).json({ message: 'Регистрация успешна' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};



export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email }, include: Role });
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    if (user.status === 'blocked') {
      return res.status(403).json({ message: 'Ваш аккаунт заблокирован' });
    }

    const isPassValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPassValid) return res.status(400).json({ message: 'Неверный пароль' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.Role.name, fullName: user.fullName },
      process.env.JWT_SECRET || 'secret_key_dev', 
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, role: user.Role.name, fullName: user.fullName } });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка при входе', error: error.message });
  }
};



export const updateProfile = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const user = await User.findByPk(req.user.id, { include: Role });
    
    user.fullName = fullName || user.fullName;
    user.email = email || user.email;
    
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }
    await user.save();

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.Role.name, fullName: user.fullName },
      process.env.JWT_SECRET || 'my_fallback_secret_key',
      { expiresIn: '24h' }
    );

    res.json({ message: 'Профиль обновлен', token });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка обновления профиля' });
  }
};