import React, { useState, useEffect } from 'react';
import api from '../api/axios';

const modalStyles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000
  },
  content: {
    background: 'white', padding: '30px', borderRadius: '8px',
    width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto'
  }
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('projects');
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);

  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [isServiceModalOpen, setServiceModalOpen] = useState(false);
  const [isEditProjectModalOpen, setEditProjectModalOpen] = useState(false);

  const [newProject, setNewProject] = useState({ name: '', description: '', startDate: '', plannedEndDate: '', userIds: [] });
  const [editProject, setEditProject] = useState(null);
  const [serviceForm, setServiceForm] = useState({ id: null, name: '', description: '' });

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
    } catch (error) { 
      console.error(error); 
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', newProject);
      fetchData();
      setProjectModalOpen(false);
      setNewProject({ name: '', description: '', startDate: '', plannedEndDate: '', userIds: [] });
    } catch (error) { 
      alert('Ошибка при создании проекта'); 
    }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/projects/${editProject.id}`, editProject);
      fetchData();
      setEditProjectModalOpen(false);
    } catch (error) { 
      alert('Ошибка обновления'); 
    }
  };

  const toggleUserStatus = async (id) => {
    try {
      await api.put(`/admin/users/${id}/status`);
      fetchData();
    } catch (error) { 
      alert('Ошибка смены статуса'); 
    }
  };

  const deleteUser = async (id) => {
    if(window.confirm('Точно удалить пользователя?')) {
      try {
        await api.delete(`/admin/users/${id}`);
        fetchData();
      } catch (error) { 
        alert('Ошибка удаления'); 
      }
    }
  };

  const openServiceModal = (service = null) => {
    if (service) setServiceForm(service);
    else setServiceForm({ id: null, name: '', description: '' });
    setServiceModalOpen(true);
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    try {
      if (serviceForm.id) await api.put(`/services/${serviceForm.id}`, serviceForm);
      else await api.post('/services', serviceForm);
      fetchData();
      setServiceModalOpen(false);
    } catch (error) { 
      alert('Ошибка сохранения услуги'); 
    }
  };

  const handleDeleteService = async (id) => {
    if(window.confirm('Удалить услугу?')) {
      try { await api.delete(`/services/${id}`); fetchData(); } 
      catch (error) { alert('Ошибка удаления'); }
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Панель Администратора</h1>
      
      <div className="tabs">
        <button className={`tab ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>Проекты</button>
        <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Пользователи</button>
        <button className={`tab ${activeTab === 'services' ? 'active' : ''}`} onClick={() => setActiveTab('services')}>Услуги</button>
      </div>

      {activeTab === 'projects' && (
        <div>
          <button onClick={() => setProjectModalOpen(true)} style={{ marginBottom: '20px', background: '#28a745', color: 'white' }}>
            + Создать новый проект
          </button>
          
          <div className="card-grid" style={{ padding: '0' }}>
            {projects.map(p => (
              <div className="card" key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--primary-color)', paddingBottom: '10px', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, background: 'none', color: 'var(--text-dark)', padding: 0 }}>{p.name}</h3>
                  <button onClick={() => { setEditProject({...p, userIds: p.Users.map(u => u.id.toString())}); setEditProjectModalOpen(true); }} style={{ padding: '5px 10px', fontSize: '0.8em' }}>Изменить</button>
                </div>
                
                <p><strong>Статус:</strong> <span className={`status-badge ${p.status === 'active' ? 'status-active' : 'status-blocked'}`}>{p.status === 'active' ? 'Активен' : 'Завершен'}</span></p>
                <p><strong>План:</strong> {p.planStatus}</p>
                <p><strong>Сроки:</strong> {new Date(p.startDate).toLocaleDateString()} — {new Date(p.plannedEndDate).toLocaleDateString()}</p>
                
                <div style={{ margin: '15px 0', padding: '10px', background: '#e9ecef', borderRadius: '4px' }}>
                  <strong>Участники ({p.Users?.length}):</strong>
                  <ul style={{ paddingLeft: '20px', marginTop: '5px' }}>
                    {p.Users?.map(u => <li key={u.id}>{u.Role?.name}: {u.fullName}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <table className="admin-table">
          <thead>
            <tr><th>ID</th><th>Роль</th><th>ФИО</th><th>Email</th><th>Статус</th><th>Действия</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td><strong>{u.Role?.name}</strong></td>
                <td>{u.fullName}</td>
                <td>{u.email}</td>
                <td><span className={`status-badge ${u.status === 'active' ? 'status-active' : 'status-blocked'}`}>{u.status === 'active' ? 'Активен' : 'Заблокирован'}</span></td>
                <td>
                  {u.Role?.name !== 'Администратор' && (
                    <>
                      <button onClick={() => toggleUserStatus(u.id)} style={{ marginRight: '10px', background: u.status === 'active' ? '#ffc107' : '#28a745' }}>
                        {u.status === 'active' ? 'Блокировать' : 'Разблокировать'}
                      </button>
                      <button onClick={() => deleteUser(u.id)} className="btn-danger">Удалить</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === 'services' && (
        <div>
          <button onClick={() => openServiceModal()} style={{ marginBottom: '20px', background: '#28a745', color: 'white' }}>+ Добавить услугу</button>
          <table className="admin-table">
            <thead>
              <tr><th>Название</th><th>Описание</th><th>Действия</th></tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.description}</td>
                  <td>
                    <button onClick={() => openServiceModal(s)} style={{ marginRight: '10px' }}>Редактировать</button>
                    <button onClick={() => handleDeleteService(s.id)} className="btn-danger">Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isEditProjectModalOpen && editProject && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.content}>
            <h2>Редактировать проект</h2>
            <form onSubmit={handleUpdateProject}>
              <div className="form-group"><label>Название</label><input type="text" value={editProject.name} onChange={e => setEditProject({...editProject, name: e.target.value})} required /></div>
              <div className="form-group"><label>Описание</label><textarea value={editProject.description} onChange={e => setEditProject({...editProject, description: e.target.value})} required /></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}><label>Начало</label><input type="date" value={editProject.startDate?.split('T')[0] || ''} onChange={e => setEditProject({...editProject, startDate: e.target.value})} required /></div>
                <div className="form-group" style={{ flex: 1 }}><label>Конец</label><input type="date" value={editProject.plannedEndDate?.split('T')[0] || ''} onChange={e => setEditProject({...editProject, plannedEndDate: e.target.value})} required /></div>
              </div>
              <div className="form-group"><label>Статус</label>
                <select value={editProject.status} onChange={e => setEditProject({...editProject, status: e.target.value})}>
                  <option value="active">Активен (В работе)</option>
                  <option value="completed">Завершен</option>
                </select>
              </div>
              <div className="form-group">
                <label>Назначить Заказчика и Прораба</label>
                <input type="text" placeholder="Поиск по имени или email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ marginBottom: '10px' }} />
                <div className="user-search-box">
                  {users
                    .filter(u => u.Role?.name !== 'Администратор')
                    .filter(u => u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(u => (
                      <label key={u.id} className="user-checkbox-label">
                        <input type="checkbox" value={u.id}
                          checked={editProject.userIds?.includes(u.id.toString())}
                          onChange={e => {
                            const idStr = u.id.toString();
                            const newIds = e.target.checked 
                              ? [...(editProject.userIds || []), idStr] 
                              : (editProject.userIds || []).filter(id => id !== idStr);
                            setEditProject({ ...editProject, userIds: newIds });
                          }}
                        />
                        {u.Role?.name}: {u.fullName} ({u.email})
                      </label>
                    ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" style={{ flex: 1 }}>Сохранить</button>
                <button type="button" onClick={() => {setEditProjectModalOpen(false); setSearchTerm('');}} className="btn-danger" style={{ flex: 1 }}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isServiceModalOpen && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.content}>
            <h2>{serviceForm.id ? 'Редактировать услугу' : 'Новая услуга'}</h2>
            <form onSubmit={handleSaveService}>
              <div className="form-group"><label>Название</label><input type="text" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} required /></div>
              <div className="form-group"><label>Описание</label><textarea rows="4" value={serviceForm.description} onChange={e => setServiceForm({...serviceForm, description: e.target.value})} required /></div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" style={{ flex: 1 }}>Сохранить</button>
                <button type="button" onClick={() => setServiceModalOpen(false)} className="btn-danger" style={{ flex: 1 }}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isProjectModalOpen && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.content}>
            <h2>Создать проект</h2>
            <form onSubmit={handleCreateProject}>
              <div className="form-group"><label>Название проекта</label><input type="text" required value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} /></div>
              <div className="form-group"><label>Описание</label><textarea value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} /></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}><label>Начало</label><input type="date" required value={newProject.startDate} onChange={e => setNewProject({...newProject, startDate: e.target.value})} /></div>
                <div className="form-group" style={{ flex: 1 }}><label>Конец</label><input type="date" required value={newProject.plannedEndDate} onChange={e => setNewProject({...newProject, plannedEndDate: e.target.value})} /></div>
              </div>
              <div className="form-group">
                <label>Назначить Заказчика и Прораба</label>
                <input type="text" placeholder="Поиск по имени или email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ marginBottom: '10px' }} />
                <div className="user-search-box">
                  {users
                    .filter(u => u.Role?.name !== 'Администратор')
                    .filter(u => u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(u => (
                      <label key={u.id} className="user-checkbox-label">
                        <input type="checkbox" value={u.id}
                          checked={newProject.userIds.includes(u.id.toString())}
                          onChange={e => {
                            const idStr = u.id.toString();
                            const newIds = e.target.checked 
                              ? [...newProject.userIds, idStr] 
                              : newProject.userIds.filter(id => id !== idStr);
                            setNewProject({ ...newProject, userIds: newIds });
                          }}
                        />
                        {u.Role?.name}: {u.fullName} ({u.email})
                      </label>
                    ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" style={{ flex: 1 }}>Создать проект</button>
                <button type="button" onClick={() => {setProjectModalOpen(false); setSearchTerm('');}} className="btn-danger" style={{ flex: 1 }}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;