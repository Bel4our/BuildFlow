import React, { useState } from 'react';

const CreateUserModal = ({ isOpen, onClose, onSave, roles }) => {
  const [newUserForm, setNewUserForm] = useState({ fullName: '', email: '', password: '', roleId: '' });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(newUserForm); 
  };

  return (
    <div style={{ /* стили оверлея */ }}>
      <div style={{ /* стили контента */ }}>
        <h2>Новый пользователь</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Роль</label>
            <select value={newUserForm.roleId} onChange={e => setNewUserForm({...newUserForm, roleId: e.target.value})} required>
              <option value="">-- Выберите роль --</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" style={{ flex: 1 }}>Создать</button>
            <button type="button" onClick={onClose} className="btn-danger" style={{ flex: 1 }}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;