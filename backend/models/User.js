import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
  },
  telegramId: {
    type: DataTypes.STRING,
    allowNull: true 
  },
  tgSettings: {
    type: DataTypes.TEXT,
    defaultValue: '{"global": true, "mutedProjects": []}'
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['email']
    }
  ]
});

export default User;