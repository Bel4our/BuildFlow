import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const Home = () => {
  const [services, setServices] = useState([]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await api.get('/services');
        setServices(res.data);
      } catch (error) {}
    };
    fetchServices();
  }, []);

  return (
    <div className="landing">
      <section className="hero">
        <h1>BuildFlow</h1>
        <p>Профессиональное управление строительными проектами в одном окне</p>
        <div className="hero-btns">
          <Link to="/register" className="btn-main">Начать работу</Link>
          <Link to="/login" className="btn-sub">Войти</Link>
        </div>
      </section>

      <section className="features">
        <div className="feat-card">
          <h3>Проекты и Этапы</h3>
          <p>Создавайте структуру проекта, разбивайте на этапы и контролируйте каждую задачу.</p>
        </div>
        <div className="feat-card">
          <h3>Живой Чат</h3>
          <p>Общайтесь между прорабом и заказчиком прямо внутри проекта. История сохраняется.</p>
        </div>
        <div className="feat-card">
          <h3>Telegram Уведомления</h3>
          <p>Мгновенно получайте отчеты о выполнении этапов в свой мессенджер.</p>
        </div>
        <div className="feat-card">
          <h3>Прогресс-бары</h3>
          <p>Визуальный контроль готовности объекта в реальном времени.</p>
        </div>
      </section>

      <div style={{ marginTop: '60px', paddingBottom: '60px' }}>
        <h2 style={{ textAlign: 'center', color: 'black', marginBottom: '30px', fontSize: '2em' }}>Наши услуги</h2>
        <section className="features">
          {services.length > 0 ? (
            services.map(service => (
              <div key={service.id} className="feat-card">
                <h3>{service.name}</h3>
                <p>{service.description}</p>
              </div>
            ))
          ) : (
            <p style={{ textAlign: 'center', width: '100%', color: 'white' }}>Загрузка услуг...</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default Home;