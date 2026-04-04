import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const Profile = () => {
  const { user, logout, login } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ 
    fullName: user?.fullName || '', 
    email: user?.email || '', 
    password: '' 
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/auth/profile', formData);
      alert('Профиль успешно обновлен!');
      login(res.data.token); // Обновляем токен в системе (чтобы обновилось имя в шапке)
      setIsEditing(false);
      setFormData({...formData, password: ''}); // Очищаем поле пароля
    } catch (error) {
      alert(error.response?.data?.message || 'Ошибка при обновлении профиля');
    }
  };

  const getInitials = (name) => name ? name.charAt(0).toUpperCase() : 'U';

  return (
    <div style={{ padding: '20px' }}>
      <div className="profile-card">
        <div className="profile-avatar">{getInitials(user?.fullName)}</div>
        
        {!isEditing ? (
          <>
            <h2>{user?.fullName}</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>{user?.email}</p>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <strong>Ваша роль:</strong> <span className="nav-role" style={{ marginLeft: '10px' }}>{user?.role}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsEditing(true)} style={{ flex: 1, background: '#17a2b8', color: 'white' }}>Редактировать профиль</button>
              <button onClick={handleLogout} className="btn-danger" style={{ flex: 1 }}>Выйти</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSave} style={{ textAlign: 'left' }}>
            <h3 style={{ marginBottom: '15px', textAlign: 'center' }}>Редактирование</h3>
            <div className="form-group">
              <label>ФИО</label>
              <input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Новый пароль (оставьте пустым, если не хотите менять)</label>
              <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="submit" style={{ flex: 1 }}>Сохранить</button>
              <button type="button" onClick={() => setIsEditing(false)} className="btn-danger" style={{ flex: 1 }}>Отмена</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Profile;