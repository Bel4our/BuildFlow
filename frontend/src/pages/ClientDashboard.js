import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { translatePlanStatus } from '../utils/translations';
import styles from './ClientDashboard.module.css';

const ClientDashboard = () => {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/projects').then(res => setProjects(res.data)).catch(console.error);
  }, []);

  return (
    <div className={styles.container}>
      <h1>Мои Проекты</h1>
      {projects.length === 0 && <p>У вас пока нет активных проектов.</p>}
      
      <div className="card-grid" style={{padding: 0}}>
        {projects.map(p => (
          <div key={p.id} 
               className={`card ${styles.projectCard}`} 
               style={{ borderLeftColor: p.planStatus === 'pending_approval' ? '#17a2b8' : '' }}
               onClick={() => navigate(`/project/${p.id}`)}>
            <h3>{p.name}</h3>
            <p><strong>Состояние плана:</strong> {translatePlanStatus(p.planStatus)}</p>
            {p.planStatus === 'pending_approval' && (
              <p className={styles.attentionText}>Требует вашего внимания (Утверждение плана)!</p>
            )}
            <button>Открыть рабочую область</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientDashboard;