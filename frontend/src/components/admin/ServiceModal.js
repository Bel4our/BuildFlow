import React, { useState, useEffect } from 'react';
import styles from './Modals.module.css';

const ServiceModal = ({ isOpen, onClose, onSave, serviceData }) => {
  const [form, setForm] = useState({ id: null, name: '', description: '' });

  useEffect(() => {
    if (serviceData) {
      setForm(serviceData);
    } else {
      setForm({ id: null, name: '', description: '' });
    }
  }, [serviceData]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const handleChange = e => setForm({...form, [e.target.name]: e.target.value});

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <h2>{form.id ? 'Редактировать услугу' : 'Новая услуга'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea name="description" rows="4" value={form.description} onChange={handleChange} required />
          </div>
          <div className={styles.flexRow} style={{ marginTop: '20px' }}>
            <button type="submit" style={{ flex: 1 }}>Сохранить</button>
            <button type="button" onClick={onClose} className="btn-danger" style={{ flex: 1 }}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceModal;