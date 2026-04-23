import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import styles from './Profile.module.css';

const Profile = () => {
  const { user, login, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({ 
    fullName: user?.fullName || '', 
    email: user?.email || '', 
    newPassword: '', 
    confirmPassword: '' 
  });
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  
  const [serverError, setServerError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const botUsername = 'BuildFl0wbot'; 

  const [hasTelegram, setHasTelegram] = useState(user?.hasTelegram || false);

  useEffect(() => {
    checkTelegramStatus();
    const onTabFocus = () => checkTelegramStatus();
    window.addEventListener('focus', onTabFocus);
    return () => window.removeEventListener('focus', onTabFocus); 
  }, []);

  const checkTelegramStatus = async () => {
    try {
      const res = await api.get('/auth/me');
      setHasTelegram(res.data.hasTelegram);
    } catch (err) {}
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const validateAndOpenModal = (e) => {
    e.preventDefault();
    setServerError('');
    setSuccessMsg('');

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      return setServerError('Новые пароли не совпадают');
    }
    setPasswordModalOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!currentPassword) return setServerError('Введите текущий пароль');

    try {
      const res = await api.put('/auth/profile', { ...formData, currentPassword });
      setSuccessMsg('Профиль успешно обновлен!');
      setFormData({ ...formData, newPassword: '', confirmPassword: '' });
      setCurrentPassword('');
      setPasswordModalOpen(false);
      if (res.data.token) login(res.data.token);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Ошибка при обновлении профиля.');
      setPasswordModalOpen(false);
      setCurrentPassword('');
    }
  };

  const getInitials = (name) => name ? name.charAt(0).toUpperCase() : 'U';

  return (
    <div className={styles.container}>
      <div className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <div className={styles.profileAvatar}>{getInitials(user?.fullName)}</div>
          <h2>{user?.fullName}</h2>
          <p>Роль: <strong>{user?.role}</strong></p>
        </div>

        <div className={styles.telegramSection}>
          <h4>Уведомления Telegram</h4>
          {hasTelegram ? (
            <div>
              <p className={styles.telegramConnected}>Telegram успешно подключен</p>
              <button onClick={async () => {
                if(window.confirm('Отключить уведомления?')) {
                  const res = await api.delete('/auth/telegram');
                  login(res.data.token); 
                  setHasTelegram(false); 
                }
              }} className="btn-danger">
                Отключить Telegram
              </button>
            </div>
          ) : (
            <div>
              <p>Получайте уведомления о завершении этапов прямо в мессенджер.</p>
              <a 
                href={`https://t.me/${botUsername}?start=${user?.id}`} 
                target="_blank" rel="noopener noreferrer"
                className={styles.telegramButton}
              >
                Подключить Telegram Бот
              </a>
            </div>
          )}
        </div>

        <h3 className={styles.sectionTitle}>Настройки профиля</h3>
        {serverError && <div className="server-error">{serverError}</div>}
        {successMsg && <div className="server-success">{successMsg}</div>}

        <form onSubmit={validateAndOpenModal}>
          <div className="form-group">
            <label>ФИО</label>
            <input type="text" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'}} />
          </div>
          <div className="form-group" style={{marginTop: '15px'}}>
            <label>Email</label>
            <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'}}/>
          </div>
          <h4 className={styles.passwordTitle}>Смена пароля</h4>
          <div className={styles.passwordFields}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Новый пароль</label>
              <input type="password" value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'}}/>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Повторите новый</label>
              <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'}}/>
            </div>
          </div>
          <button type="submit" className={styles.saveButton}>Сохранить изменения</button>
        </form>
        <button onClick={handleLogout} className={styles.logoutButton}>Выйти из аккаунта</button>
      </div>
      {isPasswordModalOpen && (
        <div className={styles.overlay}>
          <div className={styles.content}>
            <h3 style={{ marginTop: 0 }}>Подтверждение</h3>
            <p>Для сохранения изменений профиля введите ваш текущий пароль.</p>
            <form onSubmit={handleUpdate}>
              <div className="form-group" style={{marginTop: '15px'}}>
                <input type="password" placeholder="Текущий пароль" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoFocus style={{width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'}} />
              </div>
              <div className={styles.modalButtons}>
                <button type="submit" style={{ flex: 1, background: 'var(--primary-color)', color: 'black' }}>Подтвердить</button>
                <button type="button" onClick={() => { setPasswordModalOpen(false); setCurrentPassword(''); }} className="btn-danger" style={{ flex: 1 }}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;