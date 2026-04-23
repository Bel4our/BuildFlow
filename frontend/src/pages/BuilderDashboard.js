import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { translatePlanStatus } from '../utils/translations';
import styles from './BuilderDashboard.module.css';

const BuilderDashboard = () => {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/projects').then(res => setProjects(res.data)).catch(console.error);
  }, []);

  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const successRate = totalProjects === 0 ? 0 : Math.round((completedProjects / totalProjects) * 100);

  return (
    <div className={styles.container}>
      <h1>Мои Объекты</h1>

      <div className={styles.statsGrid}>
        <div className={`card ${styles.statCard} ${styles.total}`}>
          <h2>{totalProjects}</h2>
          <p>Всего проектов</p>
        </div>
        <div className={`card ${styles.statCard} ${styles.completed}`}>
          <h2>{completedProjects}</h2>
          <p>Успешно завершено</p>
        </div>
        <div className={`card ${styles.statCard} ${styles.rate}`}>
          <h2>{successRate}%</h2>
          <p>Рейтинг успешности</p>
        </div>
      </div>

      <div className="card-grid" style={{padding: 0}}>
        {projects.map(p => (
          <div key={p.id} className={`card ${styles.projectCard}`} onClick={() => navigate(`/project/${p.id}`)}>
            <h3>{p.name}</h3>
            <p><strong>Статус:</strong> {p.status === 'active' ? 'В работе' : 'Завершен'}</p>
            <p><strong>План:</strong> {translatePlanStatus(p.planStatus)}</p>
            <button>Перейти к проекту</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BuilderDashboard;