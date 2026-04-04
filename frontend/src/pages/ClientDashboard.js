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

const ClientDashboard = () => {
  const { user } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  
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

  const handleSelectProject = (proj) => {
    setSelectedProject(proj);
    loadChat(proj.id);
  };

  const toggleStage = (stageId) => {
    setExpandedStages(prev => prev.includes(stageId) ? prev.filter(id => id !== stageId) : [...prev, stageId]);
  };

  const toggleTask = (taskId) => {
    setExpandedTasks(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };

  const handleApprovePlan = async () => { 
    await api.put(`/projects/${selectedProject.id}/plan-status`, { planStatus: 'approved' }); 
    fetchProjects(); 
  };
  
  const handleRejectPlan = async () => { 
    await api.put(`/projects/${selectedProject.id}/plan-status`, { planStatus: 'rejected' }); 
    fetchProjects(); 
  };
  
  const handleApproveStage = async (stageId) => { 
    await api.put(`/tasks/stage/${stageId}/approve`); 
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
        <h2>Мои Проекты</h2>
        {projects.map(p => (
          <div key={p.id} onClick={() => handleSelectProject(p)} 
               style={{ padding: '15px', background: selectedProject?.id === p.id ? 'var(--primary-color)' : 'white', 
               cursor: 'pointer', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '10px' }}>
            <strong>{p.name}</strong><br/>
            <small>Статус: {p.planStatus}</small>
          </div>
        ))}
      </div>

      <div style={{ flex: '3' }}>
        {!selectedProject ? <h3>Выберите проект слева</h3> : (
          <div>
            <h2>{selectedProject.name}</h2>
            
            <div style={{ padding: '15px', borderRadius: '8px', marginBottom: '20px', color: 'white',
              background: selectedProject.planStatus === 'draft' ? '#6c757d' : 
                          selectedProject.planStatus === 'pending_approval' ? '#17a2b8' : 
                          selectedProject.planStatus === 'rejected' ? '#dc3545' : '#28a745' }}>
              <strong>Статус: </strong>
              {selectedProject.planStatus === 'draft' && 'Прораб разрабатывает план работ...'}
              {selectedProject.planStatus === 'pending_approval' && 'ПРОРАБ ПРИСЛАЛ ПЛАН! Внимательно проверьте этапы и примите решение.'}
              {selectedProject.planStatus === 'rejected' && 'Вы отклонили план. Ожидаем правок от прораба.'}
              {selectedProject.planStatus === 'approved' && 'План утвержден. Идут строительные работы.'}
            </div>

            {selectedProject.planStatus === 'pending_approval' && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
                <button onClick={handleApprovePlan} style={{ flex: 1, padding: '15px', background: '#28a745', color: 'white', fontSize: '1.1em' }}>УТВЕРДИТЬ ПЛАН</button>
                <button onClick={handleRejectPlan} style={{ flex: 1, padding: '15px', background: '#dc3545', color: 'white', fontSize: '1.1em' }}>ОТКЛОНИТЬ ПЛАН</button>
              </div>
            )}

            <div style={{ marginBottom: '30px' }}>
              {selectedProject.ProjectStages?.map(stage => {
                const isExpanded = expandedStages.includes(stage.id);
                const allDone = stage.Tasks?.length > 0 && stage.Tasks.every(t => t.status === 'выполнена');

                return (
                  <div key={stage.id} style={{ marginBottom: '10px' }}>
                    <div className="accordion-header" onClick={() => toggleStage(stage.id)}>
                      <span>{stage.name} <span style={{fontSize: '0.8em', color: '#666'}}>({stage.Tasks?.length || 0} задач)</span></span>
                      <span>{stage.status === 'утверждено' ? 'Утвержден' : isExpanded ? '▲' : '▼'}</span>
                    </div>
                    
                    {isExpanded && (
                      <div className="accordion-content">
                        {stage.Tasks?.map(task => (
                          <div key={task.id} style={{ marginBottom: '10px', border: '1px solid #eee', borderRadius: '4px' }}>
                            <div style={{ padding: '10px', background: '#f8f9fa', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                                 onClick={() => toggleTask(task.id)}>
                              <span><strong>Задача:</strong> {(task.description || '').substring(0, 30)}...</span>
                              <span style={{ color: task.status === 'выполнена' ? 'green' : 'orange' }}>{task.status}</span>
                            </div>
                            
                            {expandedTasks.includes(task.id) && (
                              <div style={{ padding: '15px' }}>
                                <p>{task.description}</p>
                                
                                {task.Attachments?.length > 0 && (
                                  <div style={{ marginTop: '10px' }}>
                                    <strong>Прикрепленные файлы:</strong>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
                                      {task.Attachments.map(att => (
                                        <a key={att.id} href={`http://localhost:5000${att.filePath}`} target="_blank" rel="noopener noreferrer" 
                                           style={{ padding: '5px 10px', background: '#e9ecef', borderRadius: '4px', textDecoration: 'none', color: '#333' }}>
                                          Открыть файл
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {selectedProject.planStatus === 'approved' && stage.status !== 'утверждено' && (
                          <button onClick={() => handleApproveStage(stage.id)} disabled={!allDone}
                                  style={{ width: '100%', marginTop: '10px', background: allDone ? 'var(--primary-color)' : '#e9ecef', color: allDone ? 'black' : '#999' }}>
                            {allDone ? 'Принять работу (Утвердить этап)' : 'Ожидайте выполнения всех задач этапа...'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

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
              <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Написать..." style={{ flex: 1 }} required />
              <button type="submit">Отправить</button>
            </form>

          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;