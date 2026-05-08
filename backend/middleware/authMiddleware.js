import jwt from 'jsonwebtoken';
import { User, Role } from '../models/index.js';

export const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ message: 'Токен не предоставлен' });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Неверный токен' });

    try {
      const user = await User.findByPk(decoded.id, { include: Role });
      if (!user || user.status === 'blocked' || user.status === 'deleted' || user.Role.name !== decoded.role) {
        return res.status(401).json({ message: 'Требуется авторизация' });
      }
      req.user = decoded; 
      next();
    } catch (e) {
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  });
};

export const checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Нет доступа для вашей роли' });
    }
    next();
  };
};