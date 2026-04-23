import React, { useState } from 'react';
import styles from './Modals.module.css';

const CreateUserModal = ({ isOpen, onClose, onSave, roles }) => {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', roleId: '' });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    setForm({ fullName: '', email: '', password: '', roleId: '' });
  };
  
  const handleChange = e => setForm({...form, [e.target.name]: e.target.value});

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <h2>Новый пользователь</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>ФИО</label>
            <input type="text" name="fullName" value={form.fullName} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Пароль</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Роль</label>
            <select name="roleId" value={form.roleId} onChange={handleChange} required>
              <option value="">-- Выберите роль --</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className={styles.flexRow} style={{ marginTop: '20px' }}>
            <button type="submit" style={{ flex: 1 }}>Создать</button>
            <button type="button" onClick={onClose} className="btn-danger" style={{ flex: 1 }}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;