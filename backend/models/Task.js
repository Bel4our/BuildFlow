import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

export default sequelize.define('Task', {
  description: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'новая' },
  reportText: { type: DataTypes.TEXT, allowNull: true },
  transferToUserId: { type: DataTypes.INTEGER, allowNull: true }
});