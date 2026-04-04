import React, { useState, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Заполните все поля');

    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.token) {
        login(res.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Неверный логин или пароль');
    }
  };

  return (
    <div className="form-container">
      <h2>Вход в систему</h2>
      {error && <div className="server-error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Пароль</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button type="submit" style={{ width: '100%', marginTop: '10px' }}>Войти</button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '20px' }}>
        Нет аккаунта? <Link to="/register">Создать</Link>
      </p>
    </div>
  );
};

export default Login;