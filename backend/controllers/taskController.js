import { Task, ProjectStage, Attachment, User } from '../models/index.js';

export const createTask = async (req, res) => {
  try {
    const { stageId, assignedUserId, description } = req.body;
    if (!stageId || !assignedUserId || !description) {
      return res.status(400).json({ message: "Не все поля заполнены" });
    }
    const task = await Task.create({ stageId, assignedUserId, description });
    res.status(201).json({ message: 'Задача создана', task });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка создания задачи', error: error.message });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { assignedUserId: req.user.id },
      include: [
        { model: ProjectStage, attributes: ['name', 'status', 'projectId'] },
        { model: Attachment } 
      ]
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения задач', error: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; 
    
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ message: 'Задача не найдена' });

    if (status) {
      task.status = status;
      await task.save();
    }

    if (req.files && req.files.length > 0) {
      const attachmentsData = req.files.map(file => ({
        taskId: id,
        filePath: `/uploads/${file.filename}`,
        uploadedByUserId: req.user.id
      }));
      
      await Attachment.bulkCreate(attachmentsData);
    }

    const updatedTask = await Task.findByPk(id, { include: Attachment });
    res.json({ message: 'Задача успешно обновлена', task: updatedTask });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка обновления задачи', error: error.message });
  }
};

export const approveStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const stage = await ProjectStage.findByPk(stageId);
    
    if (!stage) return res.status(404).json({ message: 'Этап не найден' });

    stage.status = 'утверждено';
    stage.actualEndDate = new Date(); 
    await stage.save();

    res.json({ message: 'Этап успешно утвержден заказчиком', stage });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка утверждения этапа', error: error.message });
  }
};


export const createStage = async (req, res) => {
  try {
    const { projectId, name, description } = req.body;
    const stage = await ProjectStage.create({ projectId, name, description });
    res.status(201).json(stage);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка создания этапа' });
  }
};

export const deleteStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    await ProjectStage.destroy({ where: { id: stageId } });
    res.json({ message: 'Этап удален' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка удаления этапа' });
  }
};