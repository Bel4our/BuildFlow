import { User, Role } from '../models/index.js';

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({ 
      include: Role, 
      attributes: { exclude: ['passwordHash'] } // Не отдаем хеши паролей на фронт
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения пользователей' });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
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
    await User.destroy({ where: { id } });
    res.json({ message: 'Пользователь удален' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка удаления' });
  }
};