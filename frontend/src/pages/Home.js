import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
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
    </div>
  );
};

export default Home;