import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { translateTaskStatus } from '../utils/translations';
import styles from './MyTasks.module.css';

const MyTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await api.get('/tasks/my');
        
       const groupedTasks = res.data.reduce((acc, task) => {
          const projectId = task.ProjectStage.projectId;
          const projectName = task.ProjectStage.Project?.name || `Проект ID: ${projectId}`;
          if (!acc[projectId]) {
            acc[projectId] = {
              projectName: projectName, 
              tasks: []
            };
          }
          acc[projectId].tasks.push(task);
          return acc;
        }, {});
        
        setTasks(Object.values(groupedTasks));
      } catch (error) {
        console.error('Ошибка загрузки задач', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTasks();
  }, []);

  if (loading) {
    return <div>Загрузка задач...</div>;
  }

  return (
    <div className={styles.container}>
      <h1>Мой список задач</h1>
      {tasks.length === 0 ? (
        <p>У вас нет назначенных задач.</p>
      ) : (
        tasks.map((projectGroup, index) => (
          <div key={index} className="card">
            <h2 className={styles.projectName}>{projectGroup.projectName}</h2>
            <ul className={styles.taskList}>
              {projectGroup.tasks.map(task => (
                <li key={task.id} className={styles.taskItem}>
                  <div className={styles.taskInfo}>
                    <p className={styles.taskDesc}>{task.description}</p>
                    <span className={styles.stageName}>Этап: {task.ProjectStage.name}</span>
                  </div>
                  <div className={styles.taskActions}>
                    <span className={`${styles.statusBadge} ${styles[task.status]}`}>
                      {translateTaskStatus(task.status)}
                    </span>
                    <button onClick={() => navigate(`/project/${task.ProjectStage.projectId}`)}>
                      Перейти к проекту
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
};

export default MyTasks;