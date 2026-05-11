import { User, Role, Task } from '../models/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { ROLES, PASS_REGEX } from '../utils/constants.js';

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({ where: { status: { [Op.ne]: 'deleted' } }, include: Role, attributes: { exclude: ['passwordHash'] } });
    res.json(users);
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === parseInt(id)) return res.status(403).json({ message: 'Error' });
    const user = await User.findByPk(id);
    const newStatus = user.status === 'active' ? 'blocked' : 'active';
    await user.update({ status: newStatus });
    res.json({ message: `Success` });
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === parseInt(id)) return res.status(403).json({ message: 'Error' });
    const user = await User.findByPk(id, { include: Role });
    if (user.Role.name === ROLES.BUILDER) {
      const count = await Task.count({ where: { assignedUserId: id, status: { [Op.ne]: 'выполнена' } } });
      if (count > 0) return res.status(400).json({ message: `Сначала переназначьте ${count} задач.` });
    }
    user.status = 'deleted';
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();
    await user.setProjects([]);
    res.json({ message: 'Success' });
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const updateUserInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, roleId } = req.body;
    if (email.length > 50) return res.status(400).json({ message: 'Email max 50' });
    const user = await User.findByPk(id, { include: Role });
    if (user.roleId !== parseInt(roleId) && (user.Role.name === ROLES.BUILDER || user.Role.name === ROLES.CLIENT)) {
      const activeProjects = await user.getProjects({ where: { status: 'active' } });
      if (activeProjects.length > 0) return res.status(403).json({ message: 'Нельзя сменить роль при активных проектах.' });
    }
    const exist = await User.findOne({ where: { email, id: { [Op.ne]: id } } });
    if (exist) return res.status(400).json({ message: 'Email exist' });
    await User.update({ fullName: fullName.substring(0,100), email, roleId }, { where: { id } });
    res.json({ message: 'Success' });
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};

export const createUser = async (req, res) => {
  try {
    const { fullName, email, password, roleId } = req.body;
    if (email.length > 50) return res.status(400).json({ message: 'Email max 50' });
    if (!PASS_REGEX.test(password)) return res.status(400).json({ message: 'Invalid password' });
    const exist = await User.findOne({ where: { email } });
    if (exist) return res.status(400).json({ message: 'Email exist' });
    const hash = await bcrypt.hash(password, 10);
    const u = await User.create({ email, passwordHash: hash, fullName: fullName.substring(0,100), roleId });
    res.status(201).json({ user: u });
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};