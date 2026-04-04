import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

export default sequelize.define('ProjectStage', {
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  plannedEndDate: { type: DataTypes.DATE },
  actualEndDate: { type: DataTypes.DATE },
  status: { 
    type: DataTypes.STRING, 
    defaultValue: 'в работе' 
  }
});