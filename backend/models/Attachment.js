import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

export default sequelize.define('Attachment', {
  filePath: { type: DataTypes.STRING, allowNull: false },
  originalName: { type: DataTypes.STRING, allowNull: false },
}, { 
  timestamps: true, 
  updatedAt: false  
});