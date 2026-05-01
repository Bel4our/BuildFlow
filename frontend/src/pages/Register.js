import React, { useState } from 'react';
import api from '../api/axios';
import { useNavigate, Link } from 'react-router-dom';
import styles from './Form.module.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', confirmPassword: '', roleName: 'Заказчик' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  const validate = () => {
    let tempErrors = {};
    if (!formData.fullName.trim()) tempErrors.fullName = "Введите ваше имя";
    if (!/\S+@\S+\.\S+/.test(formData.email)) tempErrors.email = "Некорректный email";
    if (!/^(?=.*[a-zA-Zа-яА-Я])(?=.*\d)(?=.*[^a-zA-Zа-яА-Я0-9]).{8,}$/.test(formData.password)) {
      tempErrors.password = "Пароль: мин. 8 символов, 1 буква, 1 цифра, 1 спецсимвол";
    }
    if (formData.password !== formData.confirmPassword) tempErrors.confirmPassword = "Пароли не совпадают";
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    
    if (validate()) {
      try {
        await api.post('/auth/register', formData);
        alert('Успешно! Теперь войдите в систему.');
        navigate('/login');
      } catch (err) {
        setServerError(err.response?.data?.message || 'Ошибка регистрации');
      }
    }
  };

  return (
    <div className="form-container" style={{ maxWidth: '500px' }}>
      <h2>Регистрация</h2>
      {serverError && <div className="server-error">{serverError}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Кто вы?</label>
          <div className="role-selector">
            <div className={`role-option ${formData.roleName === 'Заказчик' ? 'selected' : ''}`} 
                 onClick={() => setFormData({...formData, roleName: 'Заказчик'})}>
              Заказчик
            </div>
            <div className={`role-option ${formData.roleName === 'Прораб' ? 'selected' : ''}`} 
                 onClick={() => setFormData({...formData, roleName: 'Прораб'})}>
              Прораб
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>ФИО</label>
          <input type="text" className={errors.fullName ? 'input-error' : ''} 
                 value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
          {errors.fullName && <span className="error-text">{errors.fullName}</span>}
        </div>

        <div className="form-group">
          <label>Email</label>
          <input type="email" className={errors.email ? 'input-error' : ''}
                 value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label>Пароль</label>
          <input type="password" className={errors.password ? 'input-error' : ''}
                 value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          {errors.password && <span className="error-text">{errors.password}</span>}
        </div>

        <div className="form-group">
          <label>Повторите пароль</label>
          <input type="password" className={errors.confirmPassword ? 'input-error' : ''}
                 value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
          {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
        </div>

        <button type="submit" className={styles.submitButton}>Зарегистрироваться</button>
      </form>
      <p className={styles.redirectText}>
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </div>
  );
};

export default Register;