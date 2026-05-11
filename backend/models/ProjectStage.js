import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';
import { STAGE_STATUSES } from '../utils/constants.js';

export default sequelize.define('ProjectStage', {
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  startDate: { type: DataTypes.DATE },
  plannedEndDate: { type: DataTypes.DATE },
  actualEndDate: { type: DataTypes.DATE },
  status: { type: DataTypes.STRING, defaultValue: STAGE_STATUSES.IN_PROGRESS },
  order: { type: DataTypes.INTEGER, defaultValue: 0 }
});