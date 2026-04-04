import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME, 
  process.env.DB_USER, 
  process.env.DB_PASSWORD, 
  {
    host: process.env.DB_SERVER,
    dialect: 'mssql', 
    dialectOptions: {
      options: {
        encrypt: false, 
        trustServerCertificate: true 
      }
    },
    logging: false, 
  }
);

export default sequelize;