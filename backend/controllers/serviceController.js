import { Service } from '../models/index.js';

export const getServices = async (req, res) => {
  try {
    const services = await Service.findAll();
    res.json(services);
  } catch (error) { res.status(500).json({ message: 'Ошибка получения услуг' }); }
};

export const createService = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (name?.length > 100) return res.status(400).json({ message: 'Название услуги: максимум 100 символов' });
    if (description?.length > 500) return res.status(400).json({ message: 'Описание услуги: максимум 500 символов' });
    const service = await Service.create({ name, description });
    res.status(201).json(service);
  } catch (error) { res.status(500).json({ message: 'Ошибка создания услуги' }); }
};

export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    if (name?.length > 100) return res.status(400).json({ message: 'Название услуги: максимум 100 символов' });
    if (description?.length > 500) return res.status(400).json({ message: 'Описание услуги: максимум 500 символов' });
    await Service.update({ name, description }, { where: { id } });
    res.json({ message: 'Услуга обновлена' });
  } catch (error) { res.status(500).json({ message: 'Ошибка обновления услуги' }); }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    await Service.destroy({ where: { id } });
    res.json({ message: 'Услуга удалена' });
  } catch (error) { res.status(500).json({ message: 'Ошибка удаления' }); }
};