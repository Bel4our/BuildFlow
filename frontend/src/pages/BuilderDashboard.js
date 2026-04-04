import React, { useState, useEffect, useContext, useRef } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';

const CheckMarks = ({ isRead }) => {
  return (
    <span className={`msg-ticks ${!isRead ? 'unread' : ''}`}>
      {!isRead ? (
        <svg viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24">
          <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
        </svg>
      )}
    </span>
  );
};

const BuilderDashboard = () => {
  const { user } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  
  const [newStageName, setNewStageName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [activeStageId, setActiveStageId] = useState(null);
  const [files, setFiles] = useState([]);
  
  const [expandedStages, setExpandedStages] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState([]);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const chatRef = useRef(null);

  useEffect(() => { 
    fetchProjects(); 
  }, []);

  useEffect(() => {
    let interval;
    if (selectedProject) {
      loadChat(selectedProject.id);
      interval = setInterval(() => loadChat(selectedProject.id), 3000);
    }
    return () => clearInterval(interval);
  }, [selectedProject]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
      if (selectedProject) {
        const updated = res.data.find(p => p.id === selectedProject.id);
        setSelectedProject(updated);
      }
    } catch (error) { 
      console.error(error); 
    }
  };

  const loadChat = async (projectId) => {
    try {
      const res = await api.get(`/projects/${projectId}/messages`);
      setMessages(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleStage = (stageId) => {
    setExpandedStages(prev => prev.includes(stageId) ? prev.filter(id => id !== stageId) : [...prev, stageId]);
  };

  const toggleTask = (taskId) => {
    setExpandedTasks(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };

  const handleAddStage = async () => {
    if(!newStageName) return;
    await api.post('/tasks/stage', { projectId: selectedProject.id, name: newStageName, description: ' ' });
    setNewStageName(''); 
    fetchProjects();
  };

  const handleAddTask = async (stageId) => {
    if(!newTaskDesc) return;
    await api.post('/tasks', { stageId, assignedUserId: user.id, description: newTaskDesc });
    setNewTaskDesc(''); 
    setActiveStageId(null); 
    fetchProjects();
  };

  const submitPlan = async () => {
    if(window.confirm('Отправить план на проверку Заказчику?')) {
      await api.put(`/projects/${selectedProject.id}/plan-status`, { planStatus: 'pending_approval' });
      fetchProjects();
    }
  };

  const completeTask = async (taskId) => {
    const formData = new FormData();
    formData.append('status', 'выполнена');
    for (let i = 0; i < files.length; i++) {
      formData.append('photos', files[i]);
    }
    
    await api.put(`/tasks/${taskId}`, formData, { 
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    setFiles([]); 
    fetchProjects();
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if(!newMessage) return;
    await api.post(`/projects/${selectedProject.id}/messages`, { text: newMessage });
    setNewMessage(''); 
    loadChat(selectedProject.id);
  };

  const formatTime = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '20px' }}>
      <div style={{ flex: '1', minWidth: '250px' }}>
        <h2>Мои Объекты</h2>
        {projects.map(p => (
          <div key={p.id} onClick={() => {setSelectedProject(p); loadChat(p.id);}} 
               style={{ padding: '15px', background: selectedProject?.id === p.id ? 'var(--primary-color)' : 'white', 
               cursor: 'pointer', borderRadius: '8px', marginBottom: '10px', border: '1px solid #ccc' }}>
            <strong>{p.name}</strong><br/>
            <small>Статус: {p.planStatus}</small>
          </div>
        ))}
      </div>

      <div style={{ flex: '3' }}>
        {!selectedProject ? <h3>Выберите проект слева</h3> : (
          <div>
            <h2>Проект: {selectedProject.name}</h2>
            
            <div style={{ padding: '15px', borderRadius: '8px', marginBottom: '20px', color: 'white',
              background: selectedProject.planStatus === 'draft' ? '#6c757d' : 
                          selectedProject.planStatus === 'pending_approval' ? '#ffc107' : 
                          selectedProject.planStatus === 'rejected' ? '#dc3545' : '#28a745' }}>
              <strong>Статус: </strong>
              {selectedProject.planStatus === 'draft' && 'Черновик (Соберите план)'}
              {selectedProject.planStatus === 'pending_approval' && 'Ожидает утверждения (Редактирование заблокировано)'}
              {selectedProject.planStatus === 'rejected' && 'Отклонено! Внесите правки.'}
              {selectedProject.planStatus === 'approved' && 'УТВЕРЖДЕН! Можете работать и загружать отчеты.'}
            </div>

            <div style={{ marginBottom: '30px' }}>
              {selectedProject.ProjectStages?.map(stage => {
                const isExpanded = expandedStages.includes(stage.id);
                
                return (
                  <div key={stage.id} style={{ marginBottom: '10px' }}>
                    <div className="accordion-header" onClick={() => toggleStage(stage.id)}>
                      <span>{stage.name} <span style={{fontSize: '0.8em', color: '#666'}}>({stage.Tasks?.length || 0} задач)</span></span>
                      <span>{isExpanded ? '▲' : '▼'}</span>
                    </div>

                    {isExpanded && (
                      <div className="accordion-content">
                        {stage.Tasks?.map(task => (
                          <div key={task.id} style={{ marginBottom: '10px', border: '1px solid #eee', borderRadius: '4px' }}>
                            <div style={{ padding: '10px', background: '#f8f9fa', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                                 onClick={() => toggleTask(task.id)}>
                              <span><strong>Задача:</strong> {task.description.substring(0, 30)}...</span>
                              <span style={{ color: task.status === 'выполнена' ? 'green' : 'orange' }}>{task.status}</span>
                            </div>

                            {expandedTasks.includes(task.id) && (
                              <div style={{ padding: '15px' }}>
                                <p>{task.description}</p>
                                
                                {task.Attachments?.length > 0 && (
                                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px', marginBottom: '10px' }}>
                                    {task.Attachments.map(att => (
                                      <a key={att.id} href={`http://localhost:5000${att.filePath}`} target="_blank" rel="noopener noreferrer" 
                                         style={{ padding: '5px 10px', background: '#e9ecef', borderRadius: '4px', textDecoration: 'none', color: '#333' }}>
                                        Открыть файл
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {selectedProject.planStatus === 'approved' && task.status !== 'выполнена' && (
                                  <div style={{ marginTop: '15px', padding: '10px', background: '#e9ecef', borderRadius: '4px' }}>
                                    <input type="file" multiple onChange={e => setFiles(e.target.files)} style={{ marginBottom: '10px' }} />
                                    <button onClick={() => completeTask(task.id)} style={{ padding: '5px 15px', background: '#28a745', color: 'white' }}>
                                      Отчитаться о выполнении
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {(selectedProject.planStatus === 'draft' || selectedProject.planStatus === 'rejected') && (
                          <div style={{ marginTop: '10px' }}>
                            {activeStageId === stage.id ? (
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <input type="text" placeholder="Описание задачи..." value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} style={{ flex: 1 }} />
                                <button onClick={() => handleAddTask(stage.id)}>Сохранить</button>
                              </div>
                            ) : (
                              <button onClick={() => setActiveStageId(stage.id)} style={{ background: '#17a2b8', color: 'white' }}>+ Добавить задачу</button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {(selectedProject.planStatus === 'draft' || selectedProject.planStatus === 'rejected') && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
                  <input type="text" placeholder="Название нового этапа" value={newStageName} onChange={e => setNewStageName(e.target.value)} style={{ flex: 1 }} />
                  <button onClick={handleAddStage}>Создать этап</button>
                </div>
              )}
            </div>

            {(selectedProject.planStatus === 'draft' || selectedProject.planStatus === 'rejected') && selectedProject.ProjectStages?.length > 0 && (
              <button onClick={submitPlan} style={{ width: '100%', padding: '15px', fontSize: '1.2em', background: '#ffc107', color: 'black' }}>
                ОТПРАВИТЬ ПЛАН НА УТВЕРЖДЕНИЕ
              </button>
            )}

            <hr />
            <h3>Чат</h3>
            <div ref={chatRef} style={{ border: '1px solid #ccc', borderRadius: '8px', height: '350px', overflowY: 'scroll', padding: '15px', background: '#f8f9fa', marginBottom: '15px' }}>
              {messages.map(m => {
                const isMine = m.senderId === user.id;
                return (
                  <div key={m.id} style={{ textAlign: isMine ? 'right' : 'left', marginBottom: '15px' }}>
                    <span style={{ fontSize: '0.8em', color: '#666' }}>{m.sender?.fullName}</span>
                    <div style={{ display: 'inline-block', padding: '10px 15px', borderRadius: '15px', background: isMine ? '#d1e7dd' : 'white', border: '1px solid #ccc', marginLeft: '10px', marginRight: '10px' }}>
                      {m.text}
                      <div className="msg-meta">
                        <span className="msg-time">{formatTime(m.createdAt)}</span>
                        {isMine && <CheckMarks isRead={m.isRead} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
              <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Сообщение..." style={{ flex: 1 }} required />
              <button type="submit">Отправить</button>
            </form>

          </div>
        )}
      </div>
    </div>
  );
};

export default BuilderDashboard;