import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { translatePlanStatus, translateTaskStatus } from '../utils/translations';
import io from 'socket.io-client';
import styles from './ProjectDetails.module.css';

const isImage = (filePath) => /\.(jpeg|jpg|gif|png)$/i.test(filePath);
const backendUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
const socketUrl = process.env.NODE_ENV === 'production' ? '' : `http://${window.location.hostname}:5000`;
const socket = io(socketUrl);

const CheckMarks = ({ isRead }) => (
  <span className={styles.checkMarks} style={{ color: isRead ? '#4fb14f' : '#999' }}>
    {isRead ? <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg> 
            : <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
  </span>
);

const ProjectDetails = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [activePhoto, setActivePhoto] = useState(null);
  const [newStageName, setNewStageName] = useState('');
  const [newStageDeadline, setNewStageDeadline] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [activeStageId, setActiveStageId] = useState(null);
  const [taskFiles, setTaskFiles] = useState({});
  const [taskReports, setTaskReports] = useState({});

  const [editStageId, setEditStageId] = useState(null);
  const [editStageName, setEditStageName] = useState('');
  const [editStageDeadline, setEditStageDeadline] = useState('');
  const [editTaskId, setEditTaskId] = useState(null);
  const [editTaskDesc, setEditTaskDesc] = useState('');
  const [transferTargetId, setTransferTargetId] = useState('');
  const [activeTransferTaskId, setActiveTransferTaskId] = useState(null);
  
  const chatRef = useRef(null);
  const [hasUnread, setHasUnread] = useState(false);

  const scrollToBottom = () => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; };

  const fetchProject = async () => {
    try {
        const res = await api.get('/projects');
        const found = res.data.find(p => p.id === parseInt(id));
        setProject(found);
        if (found) {
            const chatRes = await api.get(`/projects/${id}/messages`);
            setMessages(chatRes.data);
            setTimeout(scrollToBottom, 100);
            if (chatRes.data.some(m => !m.isRead && m.senderId !== user.id)) setHasUnread(true);
        }
    } catch (error) {}
  };

  useEffect(() => { 
    fetchProject();
    socket.emit('join_project', id);

    const handleNewMessage = (newMessageData) => {
      setMessages(prev => [...prev, newMessageData]);
      setTimeout(scrollToBottom, 100);
      if (newMessageData.senderId !== user.id) setHasUnread(true);
    };

    const handleMessagesRead = ({ readerId }) => {
      if (readerId !== user.id) {
        setMessages(prev => prev.map(msg => msg.senderId === user.id ? { ...msg, isRead: true } : msg));
      }
    };

    socket.on('message_broadcast', handleNewMessage);
    socket.on('messages_read', handleMessagesRead);

    return () => {
      socket.emit('leave_project', id);
      socket.off('message_broadcast', handleNewMessage);
      socket.off('messages_read', handleMessagesRead);
    };
  }, [id]);

  const handleChatInteraction = useCallback(() => {
    if (hasUnread) {
      api.put(`/projects/${id}/messages/read`);
      setMessages(prev => prev.map(msg => msg.senderId !== user.id ? { ...msg, isRead: true } : msg));
      setHasUnread(false);
    }
  }, [hasUnread, id, user.id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if(!newMessage.trim() || newMessage.length > 500) return;
    await api.post(`/projects/${id}/messages`, { text: newMessage });
    setNewMessage('');
    handleChatInteraction();
  };

  const calculateProgress = (tasks) => {
    if (!tasks || tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'выполнена').length;
    return Math.round((completed / tasks.length) * 100);
  };

  const handleAddStage = async () => { 
    if(!newStageName) return; 
    try {
      await api.post('/tasks/stage', { projectId: id, name: newStageName, plannedEndDate: newStageDeadline || null }); 
      setNewStageName(''); 
      setNewStageDeadline('');
      fetchProject();
    } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
  };
  
  const handleDeleteStage = async (stageId) => { if(window.confirm('Точно удалить этап?')) { await api.delete(`/tasks/stage/${stageId}`); fetchProject(); } };
  
  const saveEditedStage = async (stageId) => {
    if (editStageName.trim() !== "") { 
      try {
        await api.put(`/tasks/stage/${stageId}/rename`, { name: editStageName, plannedEndDate: editStageDeadline }); 
        fetchProject();
        setEditStageId(null);
      } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
    }
  };

  const handleAddTask = async (stageId) => { if(!newTaskDesc) return; await api.post('/tasks', { stageId, assignedUserId: user.id, description: newTaskDesc }); setNewTaskDesc(''); setActiveStageId(null); fetchProject(); };
  
  const handleDeleteTask = async (taskId) => { 
    if(window.confirm('Удалить задачу?')) { 
      try {
        await api.delete(`/tasks/${taskId}`); 
        fetchProject(); 
      } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
    } 
  };
  
  const saveEditedTask = async (taskId) => {
    if (editTaskDesc.trim() !== "") { 
      try {
        await api.put(`/tasks/${taskId}/edit`, { description: editTaskDesc }); 
        fetchProject(); 
        setEditTaskId(null);
      } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
    }
  };

  const handleRejectTask = async (taskId) => {
    if(window.confirm('Вернуть задачу в работу?')) {
      await api.put(`/tasks/${taskId}/reject`);
      fetchProject();
    }
  };

  const handleDeleteAttachment = async (attId) => {
    if(window.confirm('Удалить этот файл?')) {
      await api.delete(`/tasks/attachment/${attId}`);
      fetchProject();
    }
  };

  const handleFileSelection = (taskId, files) => {
    const newFiles = Array.from(files).map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));
    setTaskFiles(prev => ({ ...prev, [taskId]: [...(prev[taskId] || []), ...newFiles] }));
  };

  const removeSelectedFile = (taskId, indexToRemove) => {
    setTaskFiles(prev => ({ ...prev, [taskId]: prev[taskId].filter((_, index) => index !== indexToRemove) }));
  };

  const completeTask = async (task) => {
    const fileObjects = taskFiles[task.id];
    const reportText = taskReports[task.id] || '';
    const hasExistingFiles = task.Attachments && task.Attachments.length > 0;

    if ((!fileObjects || fileObjects.length === 0) && !hasExistingFiles && reportText.trim() === '') {
      if (!window.confirm("Вы не прикрепили отчет и файлы. Завершить задачу без отчета?")) return;
    }
    
    const formData = new FormData();
    formData.append('status', 'выполнена');
    formData.append('reportText', reportText);
    
    if (fileObjects) {
      fileObjects.forEach(fObj => formData.append('photos', fObj.file));
    }
    
    try {
      await api.put(`/tasks/${task.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setTaskFiles(prev => { const updated = {...prev}; delete updated[task.id]; return updated; });
      setTaskReports(prev => { const updated = {...prev}; delete updated[task.id]; return updated; });
      fetchProject();
    } catch (err) { alert("Ошибка при сохранении задачи."); }
  };

  const requestTransfer = async (taskId) => {
    if (!transferTargetId) return;
    try {
      await api.put(`/tasks/${taskId}/transfer`, { targetUserId: transferTargetId });
      setActiveTransferTaskId(null);
      fetchProject();
    } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
  };

  const respondTransfer = async (taskId, action) => {
    try {
      await api.put(`/tasks/${taskId}/transfer/${action}`);
      fetchProject();
    } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
  };

  const adminReassign = async (taskId, newUserId) => {
    if (!newUserId) return;
    try {
      await api.put(`/tasks/${taskId}/reassign`, { newUserId });
      fetchProject();
    } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
  };

  const submitPlan = async () => {
    if(window.confirm('Отправить план на проверку Заказчику?')) {
      await api.put(`/projects/${id}/plan-status`, { planStatus: 'pending_approval' }); fetchProject();
    }
  };

  const handlePlanStatus = async (status) => { await api.put(`/projects/${id}/plan-status`, { planStatus: status }); fetchProject(); };
  const handleApproveStage = async (stageId) => { await api.put(`/tasks/stage/${stageId}/approve`); fetchProject(); };
  const handleRejectStage = async (stageId) => { if(window.confirm('Точно отклонить работу? Задачи вернутся прорабу.')) { await api.put(`/tasks/stage/${stageId}/reject`); fetchProject(); } };
  const finishProject = async () => {
    if(window.confirm('Вы подтверждаете успешное завершение всего проекта?')) { await api.put(`/projects/${id}/complete`); fetchProject(); }
  };

  const isOverdue = (stage) => {
    if (!stage.plannedEndDate) return false;
    if (stage.status === 'утверждено') return false;
    return new Date(stage.plannedEndDate).getTime() < new Date().setHours(0,0,0,0);
  };

  if (!project) return <div style={{textAlign: 'center', padding: '50px'}}>Загрузка проекта...</div>;

  const totalTasks = project.ProjectStages?.flatMap(s => s.Tasks) || [];
  const totalProgress = calculateProgress(totalTasks);
  const isDraft = project.planStatus === 'draft' || project.planStatus === 'rejected';
  const isApproved = project.planStatus === 'approved';
  const allStagesApproved = project.ProjectStages?.length > 0 && project.ProjectStages.every(s => s.status === 'утверждено');
  const projectBuilders = project.Users?.filter(u => u.Role?.name === 'Прораб') || [];

  const getPlanStatusClass = (status) => {
    const classes = { draft: styles.planDraft, pending_approval: styles.planPending, rejected: styles.planRejected, approved: styles.planApproved };
    return classes[status] || '';
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainContent}>
        <button onClick={() => navigate(-1)} className={styles.backButton}>← Назад</button>
        <div className={`card ${project.status === 'completed' ? styles.projectCompletedBorder : ''}`}>
          <div className={styles.stageHeaderWrapper}>
            <div className={styles.stageTitleBlock}>
              <h1 className={project.status === 'completed' ? styles.projectCompletedTitle : ''}>{project.name} {project.status === 'completed' && '(ЗАВЕРШЕН)'}</h1>
              {project.plannedEndDate && <span className={styles.deadline}>Дедлайн проекта: {new Date(project.plannedEndDate).toLocaleDateString('ru-RU')}</span>}
              {project.status === 'completed' && <span className={styles.onTime}>✅ Завершен</span>}
            </div>
          </div>
          <p className={styles.projectDescription}>{project.description}</p>
          <div className={styles.progressSection}>
            <div className={styles.progressHeader}><strong>Общий прогресс:</strong><strong>{totalProgress}%</strong></div>
            <div className="progress-container"><div className="progress-bar" style={{ width: `${totalProgress}%` }}></div></div>
          </div>
          <div className={`${styles.planStatus} ${getPlanStatusClass(project.planStatus)}`}>Статус плана: {translatePlanStatus(project.planStatus)}</div>
          {user.role === 'Прораб' && project.planStatus !== 'approved' && project.planStatus !== 'pending_approval' && project.status !== 'completed' && project.ProjectStages?.length > 0 && (
            <button onClick={submitPlan} className={styles.submitPlanButton}>ОТПРАВИТЬ ПЛАН НА УТВЕРЖДЕНИЕ</button>
          )}
          {user.role === 'Заказчик' && project.planStatus === 'pending_approval' && (
            <div className={styles.actionButtons}>
              <button onClick={() => handlePlanStatus('approved')} className="btn-success">УТВЕРДИТЬ ПЛАН</button>
              <button onClick={() => handlePlanStatus('rejected')} className="btn-danger">ОТКЛОНИТЬ ПЛАН</button>
            </div>
          )}
          {user.role === 'Заказчик' && project.status === 'active' && allStagesApproved && (
             <button onClick={finishProject} className={styles.finishProjectButton}>🎉 ПРИНЯТЬ ГОТОВЫЙ ОБЪЕКТ</button>
          )}
        </div>
        <h2>Структура работ</h2>
        {project.ProjectStages?.map(stage => {
          const stageProgress = calculateProgress(stage.Tasks);
          const allDone = stage.Tasks?.length > 0 && stage.Tasks.every(t => t.status === 'выполнена');
          const canEditStageAndTasks = user.role === 'Прораб' && project.status !== 'completed' && stage.status !== 'утверждено';
          const overdue = isOverdue(stage);

          return (
            <div key={stage.id} className={`card ${styles.stageCard}`}>
              {editStageId === stage.id ? (
                <div className={styles.inlineEditForm}>
                  <input type="text" maxLength={255} value={editStageName} onChange={e => setEditStageName(e.target.value)} autoFocus style={{flex: 2}} />
                  <input type="date" value={editStageDeadline} onChange={e => setEditStageDeadline(e.target.value)} style={{flex: 1}} title="Крайний срок этапа" />
                  <button onClick={() => saveEditedStage(stage.id)} className="btn-sm btn-success">Сохранить</button>
                  <button onClick={() => setEditStageId(null)} className="btn-sm btn-danger">Отмена</button>
                </div>
              ) : (
                <div className={styles.stageHeaderWrapper}>
                  <div className={styles.stageTitleBlock}>
                    <h3>{stage.name}</h3>
                    {stage.plannedEndDate && (
                      <span className={overdue ? styles.overdue : styles.deadline}>
                        Срок этапа: {new Date(stage.plannedEndDate).toLocaleDateString('ru-RU')} {overdue && '(Просрочено)'}
                      </span>
                    )}
                    {stage.status === 'утверждено' && <span className={styles.onTime}>✅ Выполнено</span>}
                  </div>
                  {canEditStageAndTasks && (
                    <div className={styles.stageActions}>
                      <button onClick={() => { setEditStageId(stage.id); setEditStageName(stage.name); setEditStageDeadline(stage.plannedEndDate ? stage.plannedEndDate.split('T')[0] : ''); }} className={styles.actionLink}>✏️ Редактировать</button>
                      <button onClick={() => handleDeleteStage(stage.id)} className={`${styles.actionLink} ${styles.actionLinkDanger}`}>✕ Удалить</button>
                    </div>
                  )}
                </div>
              )}
              
              <div className={styles.stageProgress}>
                <div className="progress-container"><div className="progress-bar" style={{ width: `${stageProgress}%` }}></div></div>
                <span>{stageProgress}%</span>
              </div>
              <div className={styles.tasksContainer}>
                {stage.Tasks?.map(task => {
                  const canEditThisTask = user.role === 'Администратор' || (user.role === 'Прораб' && task.assignedUserId === user.id && task.status !== 'выполнена' && project.status !== 'completed' && stage.status !== 'утверждено');
                  
                  return (
                  <div key={task.id} className={styles.taskItem} style={{ borderLeftColor: task.status === 'выполнена' ? '#28a745' : 'var(--primary-color)' }}>
                    <div className={styles.taskHeader}>
                      {editTaskId === task.id ? (
                        <div className={styles.inlineEditFormTask}>
                           <textarea maxLength={500} value={editTaskDesc} onChange={e => setEditTaskDesc(e.target.value)} autoFocus />
                           <div className={styles.inlineEditActions}>
                             <button onClick={() => saveEditedTask(task.id)} className="btn-sm btn-success">Сохранить</button>
                             <button onClick={() => setEditTaskId(null)} className="btn-sm btn-danger">Отмена</button>
                           </div>
                        </div>
                      ) : (
                        <p className={styles.taskDescText}>
                          {task.description}
                          <br/><small style={{color:'#666'}}>Исполнитель: {task.worker?.fullName || 'Не назначен'}</small>
                        </p>
                      )}
                      
                      {editTaskId !== task.id && (
                        <div className={styles.taskStatusControls}>
                          <span style={{ color: task.status === 'выполнена' ? 'green' : 'orange' }}>{translateTaskStatus(task.status)}</span>
                          {canEditThisTask && (
                            <>
                              <button onClick={() => { setEditTaskId(task.id); setEditTaskDesc(task.description); }} className="btn-sm btn-info">✏️</button>
                              <button onClick={() => handleDeleteTask(task.id)} className="btn-sm btn-danger">✕</button>
                            </>
                          )}
                          {(user.role === 'Заказчик' || (user.role === 'Прораб' && task.assignedUserId === user.id)) && task.status === 'выполнена' && project.status !== 'completed' && stage.status !== 'утверждено' && (
                             <button onClick={() => handleRejectTask(task.id)} className="btn-sm btn-warning" style={{marginLeft: '5px'}}>Вернуть в работу</button>
                          )}
                        </div>
                      )}
                    </div>

                    {user.role === 'Прораб' && task.transferToUserId === user.id && task.status !== 'выполнена' && project.status !== 'completed' && (
                      <div className={styles.transferAlert}>
                        <strong>Запрос на передачу от {project.Users?.find(u=>u.id===task.assignedUserId)?.fullName}</strong>
                        <div style={{marginTop: '5px'}}>
                          <button onClick={() => respondTransfer(task.id, 'accept')} className="btn-sm btn-success" style={{marginRight: '5px'}}>Принять</button>
                          <button onClick={() => respondTransfer(task.id, 'reject')} className="btn-sm btn-danger">Отклонить</button>
                        </div>
                      </div>
                    )}

                    {task.status !== 'выполнена' && project.status !== 'completed' && stage.status !== 'утверждено' && (
                      <div className={styles.transferControlsContainer}>
                        {user.role === 'Прораб' && task.assignedUserId === user.id && !task.transferToUserId && projectBuilders.length > 1 && (
                          activeTransferTaskId === task.id ? (
                            <div style={{display:'flex', gap:'5px', alignItems: 'center'}}>
                              <select value={transferTargetId} onChange={e => setTransferTargetId(e.target.value)} style={{padding:'5px', borderRadius:'4px'}}>
                                <option value="">Выберите прораба...</option>
                                {projectBuilders.filter(b => b.id !== user.id).map(b => <option key={b.id} value={b.id}>{b.fullName}</option>)}
                              </select>
                              <button onClick={() => requestTransfer(task.id)} className="btn-sm btn-primary">Отправить запрос</button>
                              <button onClick={() => setActiveTransferTaskId(null)} className="btn-sm btn-danger">Отмена</button>
                            </div>
                          ) : (
                            <button onClick={() => setActiveTransferTaskId(task.id)} className="btn-sm btn-secondary">Передать задачу другому прорабу</button>
                          )
                        )}
                        {user.role === 'Прораб' && task.assignedUserId === user.id && task.transferToUserId && (
                          <small style={{color: 'orange'}}>Ожидается подтверждение передачи пользователем {task.pendingTransferUser?.fullName}</small>
                        )}
                        {user.role === 'Администратор' && (
                           <div style={{display:'flex', gap:'5px', alignItems: 'center'}}>
                             <select onChange={e => adminReassign(task.id, e.target.value)} value="" style={{padding:'5px', borderRadius:'4px'}}>
                               <option value="" disabled>Назначить/передать прорабу...</option>
                               {projectBuilders.map(b => <option key={b.id} value={b.id}>{b.fullName}</option>)}
                             </select>
                           </div>
                        )}
                      </div>
                    )}

                    {(task.reportText || (task.Attachments && task.Attachments.length > 0)) && (
                      <div className={styles.taskReportBlock}>
                        <strong>{task.status === 'выполнена' ? 'Отчет о выполнении:' : 'Прикрепленные файлы:'}</strong>
                        {task.reportText && <p>{task.reportText}</p>}
                        {task.Attachments?.length > 0 && (
                          <div className={styles.attachments}>
                            {task.Attachments.map(att => (
                              <div key={att.id} className={styles.attachmentItem}>
                                {isImage(att.filePath) 
                                  ? <img src={`${backendUrl}${att.filePath}`} alt="Отчет" onClick={() => setActivePhoto(`${backendUrl}${att.filePath}`)} />
                                  : <a href={`${backendUrl}${att.filePath}`} download target="_blank" rel="noopener noreferrer">📎 Файл</a>
                                }
                                {user.role === 'Прораб' && task.assignedUserId === user.id && task.status !== 'выполнена' && (
                                  <button onClick={() => handleDeleteAttachment(att.id)} className={styles.deleteAttBtn}>✕</button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {user.role === 'Прораб' && task.assignedUserId === user.id && isApproved && task.status !== 'выполнена' && project.status !== 'completed' && (
                      <div className={styles.completeTaskForm}>
                        <textarea 
                          placeholder="Напишите отчет о проделанной работе..." 
                          value={taskReports[task.id] || ''} 
                          onChange={(e) => setTaskReports(prev => ({...prev, [task.id]: e.target.value}))}
                          className={styles.reportInput}
                        />
                        <div className={styles.fileUploadWrapper}>
                          <label className={styles.fileUploadLabel}>
                            + Прикрепить файлы
                            <input type="file" multiple onChange={(e) => handleFileSelection(task.id, e.target.files)} style={{ display: 'none' }} />
                          </label>
                          <div className={styles.selectedFilesList}>
                            {taskFiles[task.id]?.map((fObj, index) => (
                              <div key={index} className={styles.selectedFileItem}>
                                {fObj.previewUrl ? (
                                  <img src={fObj.previewUrl} alt="preview" className={styles.previewThumb} onClick={() => setActivePhoto(fObj.previewUrl)} />
                                ) : (
                                  <span>📎 {fObj.file.name}</span>
                                )}
                                <span onClick={() => removeSelectedFile(task.id, index)} className={styles.removeFileBtn}>✕</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => completeTask(task)} className="btn-success" style={{width: '100%'}}>Отметить выполненной и отправить отчет</button>
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
              {canEditStageAndTasks && (
                <div className={styles.addTaskContainer}>
                  {activeStageId === stage.id ? (
                    <div className={styles.addTaskForm}>
                      <input type="text" maxLength={500} placeholder="Описание задачи..." value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
                      <button onClick={() => handleAddTask(stage.id)}>Сохранить</button>
                      <button onClick={() => setActiveStageId(null)} className="btn-danger">Отмена</button>
                    </div>
                  ) : <button onClick={() => setActiveStageId(stage.id)} className="btn-info">+ Добавить задачу</button>}
                </div>
              )}
              {user.role === 'Заказчик' && isApproved && stage.status !== 'утверждено' && project.status !== 'completed' && (
                <div className={styles.actionButtons}>
                  <button onClick={() => handleApproveStage(stage.id)} disabled={!allDone} className="btn-primary" style={{ flex: 2, background: !allDone ? '#e9ecef' : '', color: !allDone ? '#999' : '' }}>
                    {allDone ? '✅ Принять работу (Утвердить этап)' : 'Ожидайте выполнения всех задач...'}
                  </button>
                  {allDone && (<button onClick={() => handleRejectStage(stage.id)} className="btn-danger">Отклонить</button>)}
                </div>
              )}
              {stage.status === 'утверждено' && <div className={styles.stageApproved}>✅ Этап утвержден заказчиком</div>}
            </div>
          )
        })}
        {user.role === 'Прораб' && project.status !== 'completed' && (
          <div className={`card ${styles.addStageForm}`}>
            <input type="text" maxLength={255} placeholder="Название нового этапа" value={newStageName} onChange={e => setNewStageName(e.target.value)} style={{flex: 2}} />
            <input type="date" value={newStageDeadline} onChange={e => setNewStageDeadline(e.target.value)} title="Крайний срок" style={{flex: 1}} />
            <button onClick={handleAddStage}>Создать этап</button>
          </div>
        )}
      </div>
      <div className={styles.sidebar}>
        <div className={`card ${styles.chatContainer}`} onMouseEnter={handleChatInteraction} onClick={handleChatInteraction}>
          <h3 className={styles.chatHeader}>Обсуждение проекта {hasUnread && <span style={{color:'red', fontSize:'0.7em'}}> (Новые)</span>}</h3>
          <div ref={chatRef} className={styles.chatBox}>
            {messages.length === 0 && <p className={styles.noMessages}>Сообщений пока нет...</p>}
            {Object.entries(messages.reduce((acc, m) => {
              const date = new Date(m.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
              if (!acc[date]) acc[date] = []; acc[date].push(m); return acc;
            }, {})).map(([date, msgs]) => (
              <div key={date}>
                <div className={styles.chatDate}>{date}</div>
                {msgs.map(m => {
                  const isMine = m.senderId === user.id;
                  return (
                    <div key={m.id} className={isMine ? styles.myMessageWrapper : styles.otherMessageWrapper}>
                      {!isMine && <span className={styles.senderName}>{m.sender?.fullName}</span>}
                      <div className={isMine ? styles.myMessage : styles.otherMessage}>
                        {m.text}
                        <div className={styles.messageInfo}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isMine && <CheckMarks isRead={m.isRead} />}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className={styles.chatForm}>
            <div className={styles.chatInputWrapper}>
              <input type="text" maxLength={500} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Написать..." required />
              <button type="submit">➤</button>
            </div>
            <div className={styles.charCounter} style={{color: newMessage.length === 500 ? 'red' : '#999'}}>{newMessage.length}/500</div>
          </form>
        </div>
      </div>
      {activePhoto && (
        <div className={styles.lightboxOverlay} onClick={() => setActivePhoto(null)}>
          <img src={activePhoto} className={styles.lightboxImg} alt="Увеличенное фото" />
          <div className={styles.lightboxClose}>&times;</div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;