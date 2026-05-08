import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { translatePlanStatus } from '../utils/translations';
import styles from './AdminDashboard.module.css';

import ProjectModal from '../components/admin/ProjectModal';
import CreateUserModal from '../components/admin/CreateUserModal';
import EditUserModal from '../components/admin/EditUserModal';
import ServiceModal from '../components/admin/ServiceModal';
import ConfirmModal from '../components/common/ConfirmModal';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('projects');
  
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [roles, setRoles] = useState([]); 

  const [searchProject, setSearchProject] = useState('');
  const [searchUser, setSearchUser] = useState('');

  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [isServiceModalOpen, setServiceModalOpen] = useState(false);
  const [isCreateUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setEditUserModalOpen] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, type: null, item: null });

  const [editingProject, setEditingProject] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [projRes, usersRes, servRes] = await Promise.all([
        api.get('/projects'), 
        api.get('/admin/users'),
        api.get('/services')
      ]);
      setProjects(projRes.data);
      setUsers(usersRes.data);
      setServices(servRes.data);
      const uniqueRoles = Array.from(new Map(usersRes.data.filter(u => u.Role).map(u => [u.Role.id, u.Role])).values());
      setRoles(uniqueRoles);
    } catch (error) {}
  };

  const handleSaveProject = async (projectData) => {
    try {
      if (projectData.id) await api.put(`/projects/${projectData.id}`, projectData);
      else await api.post('/projects', projectData);
      fetchData();
      setProjectModalOpen(false);
      setEditingProject(null);
    } catch (error) { alert(error.response?.data?.message || 'Ошибка при сохранении проекта'); }
  };

  const handleCreateUser = async (userData) => {
    try {
      await api.post('/admin/users', userData);
      fetchData();
      setCreateUserModalOpen(false);
    } catch (error) { alert(error.response?.data?.message || 'Ошибка создания пользователя'); }
  };

  const handleUpdateUser = async (userData) => {
    try {
      const res = await api.put(`/admin/users/${userData.id}`, userData);
      fetchData();
      setEditUserModalOpen(false);
      setEditingUser(null);
      if (res.data.token) {
        login(res.data.token);
      }
    } catch (error) { alert(error.response?.data?.message || 'Ошибка обновления пользователя'); }
  };

  const handleSaveService = async (serviceData) => {
    try {
      if (serviceData.id) await api.put(`/services/${serviceData.id}`, serviceData);
      else await api.post('/services', serviceData);
      fetchData();
      setServiceModalOpen(false);
      setEditingService(null);
    } catch (error) { alert(error.response?.data?.message || 'Ошибка'); }
  };
  
  const confirmAction = async () => {
    const { type, item } = modalState;
    try {
        if (type === 'deleteUser') {
            await api.delete(`/admin/users/${item.id}`);
        } else if (type === 'deleteService') {
            await api.delete(`/services/${item.id}`);
        } else if (type === 'deleteProject') {
            await api.delete(`/projects/${item.id}`);
        }
        fetchData();
    } catch (err) {
        alert(err.response?.data?.message || 'Произошла ошибка');
    } finally {
        setModalState({ isOpen: false, type: null, item: null });
    }
  };

  const toggleUserStatus = async (id) => {
    try { await api.put(`/admin/users/${id}/status`); fetchData(); } 
    catch (error) { alert('Ошибка смены статуса'); }
  };

  const openProjectModal = (project = null) => { setEditingProject(project); setProjectModalOpen(true); };
  const openEditUserModal = (user) => { setEditingUser(user); setEditUserModalOpen(true); };
  const openServiceModal = (service = null) => { setEditingService(service); setServiceModalOpen(true); };

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(searchProject.toLowerCase()));
  const filteredUsers = users.filter(u => u.fullName.toLowerCase().includes(searchUser.toLowerCase()) || u.email.toLowerCase().includes(searchUser.toLowerCase()));

  return (
    <div className={styles.container}>
      <ConfirmModal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, type: null, item: null })}
        onConfirm={confirmAction}
        title={modalState.type === 'deleteUser' ? "Удалить пользователя?" : modalState.type === 'deleteService' ? "Удалить услугу?" : "Удалить проект?"}
        message="Это действие нельзя будет отменить."
      />

      <h1>Панель Администратора</h1>
      <div className="tabs">
        <button className={`tab ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>Проекты</button>
        <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Пользователи</button>
        <button className={`tab ${activeTab === 'services' ? 'active' : ''}`} onClick={() => setActiveTab('services')}>Услуги</button>
      </div>

      {activeTab === 'projects' && (
        <div>
          <div className={styles.controlsRow}>
            <button onClick={() => openProjectModal()} className="btn-primary">+ Создать новый проект</button>
            <input type="text" placeholder="Поиск проектов..." value={searchProject} onChange={e => setSearchProject(e.target.value)} className={styles.searchBar} />
          </div>
          <div className="card-grid">
            {filteredProjects.map(p => (
              <div className="card" key={p.id}>
                <div className={styles.cardHeader}>
                  <h3 className={`${styles.cardTitle} ${styles.truncateMultiline}`} title={p.name}>{p.name}</h3>
                  <div style={{display:'flex', gap:'5px', flexShrink: 0}}>
                    <button onClick={() => openProjectModal(p)} className="btn-secondary">Изменить</button>
                    {p.planStatus === 'draft' && (
                      <button onClick={() => setModalState({ isOpen: true, type: 'deleteProject', item: p })} className="btn-danger">✕</button>
                    )}
                  </div>
                </div>
                <p><strong>ID:</strong> {p.id}</p>
                <p><strong>Статус:</strong> <span className={`status-badge ${p.status === 'active' ? 'status-active' : 'status-blocked'}`}>{p.status === 'active' ? 'Активен' : 'Завершен'}</span></p>
                <p><strong>План:</strong> {translatePlanStatus(p.planStatus)}</p>
                <div className={styles.participants}>
                  <strong>Участники ({p.Users?.length}):</strong>
                  <ul>
                    {p.Users?.map(u => <li key={u.id} className={styles.truncate}>{u.Role?.name}: {u.fullName}</li>)}
                    {p.Users?.length === 0 && <li className={styles.noParticipants}>Не назначены</li>}
                  </ul>
                </div>
                <button onClick={() => navigate(`/project/${p.id}`)} className="btn-info" style={{ width: '100%' }}>Раскрыть проект</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          <div className={styles.controlsRow}>
            <button onClick={() => setCreateUserModalOpen(true)} className="btn-primary">+ Создать пользователя</button>
            <input type="text" placeholder="Поиск по имени или email..." value={searchUser} onChange={e => setSearchUser(e.target.value)} className={styles.searchBar} />
          </div>
          <div className={styles.tableResponsive}>
            <table className="admin-table">
              <thead>
                <tr><th>ID</th><th>Роль</th><th>ФИО</th><th>Email</th><th>Статус</th><th>Действия</th></tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td><strong>{u.Role?.name}</strong></td>
                    <td>{u.fullName}</td>
                    <td>{u.email}</td>
                    <td><span className={`status-badge ${u.status === 'active' ? 'status-active' : 'status-blocked'}`}>{u.status === 'active' ? 'Активен' : 'Заблокирован'}</span></td>
                    <td>
                      <div className={styles.actionButtonsContainer}>
                        <button onClick={() => openEditUserModal(u)} className="btn-info">Редактировать</button>
                        {u.Role?.name !== 'Администратор' && (
                          <>
                            <button onClick={() => toggleUserStatus(u.id)} className={u.status === 'active' ? 'btn-warning' : 'btn-success'}>
                              {u.status === 'active' ? 'Блокировать' : 'Разблокировать'}
                            </button>
                            <button onClick={() => setModalState({ isOpen: true, type: 'deleteUser', item: u })} className="btn-danger">Удалить</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'services' && (
        <div>
          <button onClick={() => openServiceModal()} className="btn-primary" style={{marginBottom: '15px'}}>+ Добавить услугу</button>
          <div className={styles.tableResponsive}>
            <table className="admin-table">
              <thead>
                <tr><th>ID</th><th>Название</th><th>Описание</th><th>Действия</th></tr>
              </thead>
              <tbody>
                {services.map(s => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.description}</td>
                    <td>
                      <div className={styles.actionButtonsContainer}>
                        <button onClick={() => openServiceModal(s)} className="btn-info">Изменить</button>
                        <button onClick={() => setModalState({ isOpen: true, type: 'deleteService', item: s })} className="btn-danger">Удалить</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProjectModal isOpen={isProjectModalOpen} onClose={() => { setProjectModalOpen(false); setEditingProject(null); }} onSave={handleSaveProject} projectData={editingProject} users={users} />
      <CreateUserModal isOpen={isCreateUserModalOpen} onClose={() => setCreateUserModalOpen(false)} onSave={handleCreateUser} roles={roles} />
      <EditUserModal isOpen={isEditUserModalOpen} onClose={() => { setEditUserModalOpen(false); setEditingUser(null); }} onSave={handleUpdateUser} userData={editingUser} roles={roles} />
      <ServiceModal isOpen={isServiceModalOpen} onClose={() => { setServiceModalOpen(false); setEditingService(null); }} onSave={handleSaveService} serviceData={editingService} />
    </div>
  );
};

export default AdminDashboard;