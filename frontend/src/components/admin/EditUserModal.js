import React, { useState, useEffect, useContext } from 'react';
import styles from './Modals.module.css';
import { AuthContext } from '../../context/AuthContext';

const EditUserModal = ({ isOpen, onClose, onSave, userData, roles }) => {
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState({ id: null, fullName: '', email: '', roleId: '' });

  useEffect(() => {
    if (userData) {
      setForm({
        id: userData.id,
        fullName: userData.fullName,
        email: userData.email,
        roleId: userData.roleId,
      });
    }
  }, [userData]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const handleChange = e => setForm({...form, [e.target.name]: e.target.value});

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <h2>Редактировать пользователя</h2>
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
            <label>Роль</label>
            <select name="roleId" value={form.roleId} onChange={handleChange} required disabled={user.id === form.id}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {user.id === form.id && <small style={{color: 'red'}}>Вы не можете изменить свою собственную роль</small>}
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

export default EditUserModal;