import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

export default sequelize.define('Project', {
  name: { type: DataTypes.STRING(150), allowNull: false },
  description: { type: DataTypes.TEXT },
  startDate: { type: DataTypes.DATE },
  plannedEndDate: { type: DataTypes.DATE },
  actualEndDate: { type: DataTypes.DATE },
  status: { type: DataTypes.STRING, defaultValue: 'active' }, 
  planStatus: { type: DataTypes.STRING, defaultValue: 'draft' } 
});