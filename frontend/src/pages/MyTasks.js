import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { translateTaskStatus } from '../utils/translations';
import styles from './MyTasks.module.css';

const MyTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await api.get('/tasks/my');
        const groupedTasks = res.data.reduce((acc, task) => {
          const projectId = task.ProjectStage.projectId;
          const projectName = task.ProjectStage.Project?.name || `Проект ID: ${projectId}`;
          if (!acc[projectId]) acc[projectId] = { projectId, projectName, tasks: [] };
          acc[projectId].tasks.push(task);
          return acc;
        }, {});
        setTasks(Object.values(groupedTasks));
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const handleNavigate = (projectId, taskId) => {
    navigate(`/project/${projectId}`, { state: { scrollToTaskId: taskId } });
  };

  if (loading) return <div>Загрузка задач...</div>;

  const uniqueProjects = Array.from(new Set(tasks.map(g => g.projectName)));

  const filteredGroups = tasks.filter(group => {
    if (projectFilter && group.projectName !== projectFilter) return false;
    return true;
  }).map(group => {
    const filteredTasks = group.tasks.filter(task => {
      const matchesSearch = task.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            task.ProjectStage.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter ? task.status === statusFilter : true;
      return matchesSearch && matchesStatus;
    });
    return { ...group, tasks: filteredTasks };
  }).filter(group => group.tasks.length > 0);

  return (
    <div className={styles.container}>
      <h1>Мой список задач</h1>
      
      <div className={styles.filters}>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className={styles.filterSelect}>
          <option value="">Все проекты</option>
          {uniqueProjects.map(p => <option key={p} value={p}>{p.length > 50 ? p.substring(0, 50) + '...' : p}</option>)}
        </select>
        
        <input 
          type="text" 
          placeholder="Поиск по задачам и этапам..." 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
          className={styles.searchInput}
        />
        
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={styles.filterSelect}>
          <option value="">Все статусы</option>
          <option value="новая">Новые</option>
          <option value="в работе">В работе</option>
          <option value="выполнена">Выполненные</option>
          <option value="отменена">Отменена</option>
        </select>
      </div>

      {filteredGroups.length === 0 ? (
        <p>Задач не найдено.</p>
      ) : (
        filteredGroups.map((projectGroup, index) => (
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
                    <span className={`${styles.statusBadge} ${styles[task.status.replace(' ', '_')]}`}>
                      {translateTaskStatus(task.status)}
                    </span>
                    <button onClick={() => handleNavigate(projectGroup.projectId, task.id)}>
                      Перейти к задаче
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