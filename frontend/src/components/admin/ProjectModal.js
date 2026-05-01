import React, { useState, useEffect } from 'react';
import styles from './Modals.module.css';

const ProjectModal = ({ isOpen, onClose, onSave, projectData, users }) => {
  const [project, setProject] = useState({ name: '', description: '', startDate: '', plannedEndDate: '', status: 'active' });
  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedBuilders, setSelectedBuilders] = useState([]);
  const [searchClient, setSearchClient] = useState('');
  const [searchBuilder, setSearchBuilder] = useState('');

  useEffect(() => {
    if (projectData) {
      setProject({
        id: projectData.id,
        name: projectData.name,
        description: projectData.description,
        startDate: projectData.startDate?.split('T')[0] || '',
        plannedEndDate: projectData.plannedEndDate?.split('T')[0] || '',
        status: projectData.status
      });
      const clients = projectData.Users.filter(u => u.Role?.name === 'Заказчик').map(u => u.id);
      const builders = projectData.Users.filter(u => u.Role?.name === 'Прораб').map(u => u.id);
      setSelectedClients(clients);
      setSelectedBuilders(builders);
    } else {
      setProject({ name: '', description: '', startDate: '', plannedEndDate: '', status: 'active' });
      setSelectedClients([]);
      setSelectedBuilders([]);
    }
    setSearchClient('');
    setSearchBuilder('');
  }, [projectData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const userIds = [...selectedClients, ...selectedBuilders];
    onSave({ ...project, userIds });
  };

  const handleCheck = (id, list, setList) => {
    if (list.includes(id)) setList(list.filter(i => i !== id));
    else setList([...list, id]);
  };

  const clientUsers = users.filter(u => u.Role?.name === 'Заказчик' && u.status === 'active' && (u.fullName.toLowerCase().includes(searchClient.toLowerCase()) || u.email.toLowerCase().includes(searchClient.toLowerCase())));
  const builderUsers = users.filter(u => u.Role?.name === 'Прораб' && u.status === 'active' && (u.fullName.toLowerCase().includes(searchBuilder.toLowerCase()) || u.email.toLowerCase().includes(searchBuilder.toLowerCase())));

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <h2>{projectData ? 'Редактировать проект' : 'Создать проект'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название проекта</label>
            <input type="text" maxLength={150} required value={project.name} onChange={e => setProject({ ...project, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea required rows="4" value={project.description} onChange={e => setProject({ ...project, description: e.target.value })} />
          </div>
          <div className={styles.flexRow}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Начало</label>
              <input type="date" required value={project.startDate} onChange={e => setProject({ ...project, startDate: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Конец (план)</label>
              <input type="date" required min={project.startDate} value={project.plannedEndDate} onChange={e => setProject({ ...project, plannedEndDate: e.target.value })} />
            </div>
          </div>
          {projectData && (
            <div className="form-group">
              <label>Статус</label>
              <select value={project.status} onChange={e => setProject({ ...project, status: e.target.value })}>
                <option value="active">Активен (В работе)</option>
                <option value="completed">Завершен</option>
              </select>
            </div>
          )}
          <div className={styles.teamSection}>
            <h4>Назначение команды</h4>
            <div className="form-group">
              <label>Заказчики</label>
              <input type="text" placeholder="Поиск по ФИО или Email..." value={searchClient} onChange={e => setSearchClient(e.target.value)} className={styles.searchInput} />
              <div className={styles.checkboxList}>
                {clientUsers.map(u => (
                  <label key={u.id} className={styles.checkboxLabel}>
                    <div className={styles.checkboxText}>
                      <span className={styles.cbName}>{u.fullName}</span>
                      <small className={styles.cbEmail}>{u.email}</small>
                    </div>
                    <input type="checkbox" checked={selectedClients.includes(u.id)} onChange={() => handleCheck(u.id, selectedClients, setSelectedClients)} />
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Прорабы</label>
              <input type="text" placeholder="Поиск по ФИО или Email..." value={searchBuilder} onChange={e => setSearchBuilder(e.target.value)} className={styles.searchInput} />
              <div className={styles.checkboxList}>
                {builderUsers.map(u => (
                  <label key={u.id} className={styles.checkboxLabel}>
                    <div className={styles.checkboxText}>
                      <span className={styles.cbName}>{u.fullName}</span>
                      <small className={styles.cbEmail}>{u.email}</small>
                    </div>
                    <input type="checkbox" checked={selectedBuilders.includes(u.id)} onChange={() => handleCheck(u.id, selectedBuilders, setSelectedBuilders)} />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.flexRow} style={{ marginTop: '20px' }}>
            <button type="submit" style={{ flex: 1 }}>Сохранить</button>
            <button type="button" onClick={onClose} className="btn-danger" style={{ flex: 1 }}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;