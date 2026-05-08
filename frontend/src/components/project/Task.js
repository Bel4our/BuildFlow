import React, { useState } from 'react';
import api from '../../api/axios';
import { translateTaskStatus } from '../../utils/translations';
import styles from '../../pages/ProjectDetails.module.css';

const isImage = (f) => /\.(jpeg|jpg|gif|png)$/i.test(f);
const backendUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

const Task = ({ task, taskIndex, stage, project, user, fetchProject, setModalState, setActivePhoto, moveTask, isFirstTask, isLastTask }) => {
  const [editTaskId, setEditTaskId] = useState(null);
  const [editTaskDesc, setEditTaskDesc] = useState('');
  const [taskFiles, setTaskFiles] = useState([]);
  const [taskReport, setTaskReport] = useState('');
  const [transferId, setTransferId] = useState('');

  const projectBuilders = project.Users?.filter(u => u.Role.name === 'Прораб') || [];
  const canEdit = user.role === 'Прораб' && task.assignedUserId === user.id && task.status !== 'выполнена' && stage.status !== 'утверждено';

  const saveEditedTask = async () => {
    if (editTaskDesc.trim() !== "") { 
      try {
        await api.put(`/tasks/${task.id}/edit`, { description: editTaskDesc }); 
        fetchProject(); 
        setEditTaskId(null);
      } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
    }
  };

  const handleFileSelection = (e) => {
    const newFiles = Array.from(e.target.files).map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));
    setTaskFiles(prev => [...prev, ...newFiles]);
  };

  const removeSelectedFile = (indexToRemove) => {
    setTaskFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const completeTask = async () => {
    const formData = new FormData();
    formData.append('status', 'выполнена');
    formData.append('reportText', taskReport);
    taskFiles.forEach(fObj => formData.append('photos', fObj.file));
    try {
      await api.put(`/tasks/${task.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setTaskFiles([]); setTaskReport('');
      fetchProject();
    } catch (err) { alert("Ошибка при сохранении задачи."); }
  };
  
  const adminReassign = async (newUserId) => {
    if (!newUserId) return;
    try {
      await api.put(`/tasks/${task.id}/reassign`, { newUserId });
      fetchProject();
    } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
  };

  return (
    <div id={`task-${task.id}`} className={styles.taskItem} style={{ borderLeftColor: task.status === 'выполнена' ? '#28a745' : 'var(--primary-color)' }}>
      <div className={styles.taskHeader}>
        {editTaskId === task.id ? (
          <div className={styles.inlineEditFormTask}>
            <textarea maxLength={500} value={editTaskDesc} onChange={e => setEditTaskDesc(e.target.value)} autoFocus />
            <div className={styles.inlineEditActions}>
              <button onClick={saveEditedTask} className="btn-sm btn-success">Сохранить</button>
              <button onClick={() => setEditTaskId(null)} className="btn-sm btn-danger">Отмена</button>
            </div>
          </div>
        ) : (
          <p className={styles.taskDescText}>
            {task.description}<br/><small style={{color:'#666'}}>Исполнитель: {task.worker?.fullName || 'Не назначен'}</small>
          </p>
        )}

        {editTaskId !== task.id && (
          <div className={styles.taskStatusControls}>
            <span style={{ color: task.status === 'выполнена' ? 'green' : 'orange' }}>{translateTaskStatus(task.status)}</span>
            {(canEdit || user.role === 'Администратор') && task.status !== 'выполнена' && (
              <div className={styles.orderButtons}>
                <button onClick={() => moveTask(stage.id, taskIndex, 'up')} disabled={isFirstTask}>↑</button>
                <button onClick={() => moveTask(stage.id, taskIndex, 'down')} disabled={isLastTask}>↓</button>
              </div>
            )}
            {canEdit && <button onClick={() => { setEditTaskId(task.id); setEditTaskDesc(task.description); }} className="btn-sm btn-info">✏️</button>}
            {(canEdit || user.role === 'Администратор') && task.status !== 'выполнена' && <button onClick={() => setModalState({isOpen: true, type: 'deleteTask', item: task})} className="btn-sm btn-danger">✕</button>}
            
            {task.status === 'выполнена' && (user.role === 'Заказчик' || (user.role === 'Прораб' && task.assignedUserId === user.id)) && project.status !== 'completed' && stage.status !== 'утверждено' && (
              <button onClick={() => setModalState({isOpen: true, type: 'rejectTask', item: task})} className="btn-sm btn-warning" style={{marginLeft: '10px'}}>Вернуть в работу</button>
            )}
          </div>
        )}
      </div>

      <div className={styles.taskLowerControls}>
        {canEdit && task.status === 'новая' && <button onClick={() => api.put(`/tasks/${task.id}`, {status: 'в работе'}).then(fetchProject)} className="btn-sm btn-primary">Взять в работу</button>}
        {canEdit && task.status === 'в работе' && <button onClick={() => api.put(`/tasks/${task.id}`, {status: 'новая'}).then(fetchProject)} className="btn-sm btn-secondary">Вернуть в "Новые"</button>}
      </div>

      {task.status !== 'выполнена' && project.status !== 'completed' && stage.status !== 'утверждено' && (
        <div className={styles.transferControlsContainer}>
          {user.role === 'Прораб' && task.assignedUserId === user.id && task.status === 'новая' && !task.transferToUserId && (
              <div style={{display:'flex', gap:'10px', alignItems: 'center'}}>
                <select value={transferId} onChange={e => setTransferId(e.target.value)} style={{padding:'5px', borderRadius:'4px', border:'1px solid #ccc'}}>
                  <option value="">Передать прорабу...</option>
                  {projectBuilders.filter(u => u.id !== user.id).map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
                <button onClick={() => api.put(`/tasks/${task.id}/transfer`, {targetUserId: transferId}).then(fetchProject)} className="btn-sm btn-primary">Отправить</button>
              </div>
          )}

          {task.transferToUserId && task.assignedUserId === user.id && (
            <div className={styles.transferWaiting}>
              <small>Ждем ответа от {task.pendingTransferUser?.fullName}</small>
              <button onClick={() => api.put(`/tasks/${task.id}/transfer/cancel`).then(fetchProject)} className="btn-sm btn-danger" style={{marginLeft:'10px'}}>Отменить запрос</button>
            </div>
          )}

          {user.role === 'Администратор' && (
            <div style={{display:'flex', gap:'10px', alignItems: 'center'}}>
              <select onChange={e => adminReassign(e.target.value)} value={task.assignedUserId || ""} style={{padding:'5px', borderRadius:'4px', border:'1px solid #ccc'}}>
                <option value="" disabled>Назначить прораба...</option>
                {projectBuilders.map(b => <option key={b.id} value={b.id}>{b.fullName}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {task.status === 'в работе' && canEdit && project.planStatus === 'approved' && (
        <div className={styles.completeTaskForm}>
          <textarea placeholder="Напишите отчет о проделанной работе..." value={taskReport} onChange={e=>setTaskReport(e.target.value)} className={styles.reportInput}/>
          <div className={styles.fileUploadWrapper}>
            <label className={styles.fileUploadLabel}>
              + Прикрепить файлы
              <input type="file" multiple onChange={handleFileSelection} style={{ display: 'none' }} />
            </label>
            <div className={styles.selectedFilesList}>
              {taskFiles.map((fObj, index) => (
                <div key={index} className={styles.selectedFileItem}>
                  {fObj.previewUrl ? (
                    <img src={fObj.previewUrl} alt="preview" className={styles.previewThumb} onClick={() => setActivePhoto(fObj.previewUrl)} />
                  ) : (<span>{fObj.file.name}</span>)}
                  <span onClick={() => removeSelectedFile(index)} className={styles.removeFileBtn}>✕</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={completeTask} className="btn-success" style={{width:'100%'}}>Отметить выполненной и отправить отчет</button>
        </div>
      )}

      {(task.reportText || task.Attachments?.length > 0) && (
        <div className={styles.taskReportBlock}>
          <strong>{task.status === 'выполнена' ? 'Отчет о выполнении:' : 'Прикрепленные файлы:'}</strong>
          {task.reportText && <p>{task.reportText}</p>}
          <div className={styles.attachments}>
            {task.Attachments?.map(a => (
              <div key={a.id} className={styles.attachmentItem}>
                {isImage(a.filePath) ? (
                  <img src={`${backendUrl}${a.filePath}`} alt="Отчет" onClick={() => setActivePhoto(`${backendUrl}${a.filePath}`)} />
                ) : (
                  <a href={`${backendUrl}${a.filePath}`} target="_blank" rel="noreferrer">📎 {a.filePath.split('-').pop()}</a>
                )}
                {canEdit && task.status !== 'выполнена' && (
                  <button onClick={() => setModalState({isOpen: true, type: 'deleteAttachment', item: {id: a.id}})} className={styles.deleteAttBtn}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Task;