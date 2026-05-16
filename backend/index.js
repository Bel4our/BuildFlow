import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';
import { Sequelize } from 'sequelize';
import { MulterError } from 'multer';

import { checkOverdueStages } from './services/cronService.js';

import { sequelize, seedDatabase } from './models/index.js';
import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import initializeSocket from './services/socketService.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
      origin: "*", 
      methods: ["GET", "POST"]
    }
});
initializeSocket(io);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/order', orderRoutes);

app.use((err, req, res, next) => {
    if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'Файл слишком большой. Максимальный размер — 10 МБ.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ message: 'Можно прикрепить не более 10 файлов за одну отправку.' });
        }
    }
    next(err);
});


const startServer = async () => {
    while (true) { 
        try {
            console.log('Проверка подключения к SQL Server...');
            const masterSequelize = new Sequelize('master', process.env.DB_USER, process.env.DB_PASSWORD, {
                host: process.env.DB_SERVER,
                dialect: 'mssql',
                logging: false,
                dialectOptions: { options: { encrypt: false, trustServerCertificate: true } }
            });

            await masterSequelize.authenticate();
            await masterSequelize.query(`IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${process.env.DB_NAME}') CREATE DATABASE [${process.env.DB_NAME}];`);
            await masterSequelize.close();

            await sequelize.authenticate();
            await sequelize.sync(); 
            await seedDatabase();

            console.log('БД готова. Запуск сервера...');
            server.listen(process.env.PORT || 5000, '0.0.0.0', () => {
                console.log(`СЕРВЕР РАБОТАЕТ НА ПОРТУ ${process.env.PORT || 5000}`);
            });
            break; 

        } catch (err) {
            console.error('Ошибка:', err.message);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

setInterval(checkOverdueStages, 1000 * 60 * 60 * 24);
startServer();