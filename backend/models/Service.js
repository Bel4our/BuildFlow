import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

export default sequelize.define('Service', {
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT }
}, { timestamps: false });