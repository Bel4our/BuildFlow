import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

export default sequelize.define('Message', {
  text: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false }
});