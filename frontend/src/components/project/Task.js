import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { translateTaskStatus } from '../../utils/translations';
import styles from '../../pages/ProjectDetails.module.css';

const isImage = (f) => /\.(jpeg|jpg|gif|png)$/i.test(f);
const backendUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

/** Согласовано с backend: taskRoutes multer.array('photos', 10); uploadMiddleware limits.fileSize 10 МБ */
const MAX_ATTACHMENTS_PER_SUBMIT = 10;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const Task = ({ task, taskIndex, stage, project, user, fetchProject, setModalState, setActivePhoto, isEditingPlan, moveTask, isFirstTask, isLastTask, handleDraftTaskEdit, removeDraftTask }) => {
  const [editTaskDesc, setEditTaskDesc] = useState(task.description);
  const [taskFiles, setTaskFiles] = useState([]);
  const [taskReport, setTaskReport] = useState('');
  const [transferId, setTransferId] = useState('');

  useEffect(() => {
    if (isEditingPlan) handleDraftTaskEdit(stage.id, task.id, editTaskDesc);
  }, [editTaskDesc]);

  const canWork = user.role === 'Прораб' && task.assignedUserId === user.id && task.status !== 'отменена' && stage.status !== 'утверждено' && stage.status !== 'ожидает утверждения' && !isEditingPlan && project.planStatus === 'approved' && project.status === 'active';

  const canEditAttachments = 
    (user.role === 'Прораб' && task.assignedUserId === user.id) &&
    task.status !== 'выполнена' &&
    task.status !== 'отменена' &&
    stage.status !== 'утверждено' &&
    project.status === 'active';

  const handleFileSelection = (e) => {
    const picked = Array.from(e.target.files);
    e.target.value = '';

    const slotsLeft = MAX_ATTACHMENTS_PER_SUBMIT - taskFiles.length;
    const msgs = [];

    if (slotsLeft <= 0 && picked.length > 0) {
      alert('За один раз можно прикрепить не более 10 файлов. Удалите лишнее из списка и добавьте снова.');
      return;
    }

    const tooLargeNames = [];
    const next = [...taskFiles];

    for (const file of picked) {
      if (next.length >= MAX_ATTACHMENTS_PER_SUBMIT) break;

      if (file.size > MAX_ATTACHMENT_BYTES) {
        tooLargeNames.push(file.name);
        continue;
      }

      next.push({
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      });
    }

    if (tooLargeNames.length > 0) {
      msgs.push(
        `Размер каждого файла не может превышать 10 МБ. Такие файлы не добавлены: ${tooLargeNames.join(', ')}`
      );
    }

    const validInPicker = picked.filter((f) => f.size <= MAX_ATTACHMENT_BYTES).length;
    if (slotsLeft > 0 && validInPicker > slotsLeft) {
      msgs.push(
        `Можно добавить только ${slotsLeft} файл(ов) — суммарно не более ${MAX_ATTACHMENTS_PER_SUBMIT} за одну отправку. Часть выбранных файлов не попала в список.`
      );
    }

    if (msgs.length) alert(msgs.join('\n\n'));
    setTaskFiles(next);
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
    } catch (err) {
      const m = err.response?.data?.message;
      alert(m || 'Ошибка при сохранении задачи.');
    }
  };

  return (
    <div className={styles.taskItem} style={{ borderLeftColor: task.status === 'выполнена' ? '#28a745' : task.status === 'отменена' ? '#6c757d' : 'var(--primary-color)' }}>
      <div className={styles.taskHeader}>
        
        {isEditingPlan ? (
          <div className={styles.inlineEditFormTask} style={{flex: 1, marginRight: '10px'}}>
            <textarea value={editTaskDesc} onChange={e => setEditTaskDesc(e.target.value)} />
          </div>
        ) : (
          <p className={styles.taskDescText}>
            {task.description}<br/><small style={{color:'#666'}}>Исполнитель: {task.worker?.fullName || 'Не назначен'}</small>
          </p>
        )}

        {isEditingPlan && (
          <div className={styles.taskStatusControls}>
            <div className={styles.orderButtons}>
              <button onClick={() => moveTask(stage.id, taskIndex, 'up')} disabled={isFirstTask}>↑</button>
              <button onClick={() => moveTask(stage.id, taskIndex, 'down')} disabled={isLastTask}>↓</button>
            </div>
            <button onClick={() => removeDraftTask(stage.id, task.id)} className="btn-sm btn-danger">✕</button>
          </div>
        )}

        {!isEditingPlan && (
          <div className={styles.taskStatusControls}>
            <span style={{ color: task.status === 'выполнена' ? 'green' : task.status === 'отменена' ? 'gray' : 'orange' }}>{translateTaskStatus(task.status)}</span>
            {task.status === 'выполнена' && (user.role === 'Заказчик' || (user.role === 'Прораб' && task.assignedUserId === user.id)) && project.status === 'active' && stage.status === 'в работе' && (
              <button onClick={() => setModalState({isOpen: true, type: 'rejectTask', item: task})} className="btn-sm btn-warning" style={{marginLeft: '10px'}}>Вернуть в работу</button>
            )}
          </div>
        )}
      </div>

      <div className={styles.taskLowerControls}>
        {canWork && task.status === 'новая' && <button onClick={() => api.put(`/tasks/${task.id}`, {status: 'в работе'}).then(fetchProject)} className="btn-sm btn-primary">Взять в работу</button>}
        {canWork && task.status === 'в работе' && <button onClick={() => api.put(`/tasks/${task.id}`, {status: 'новая'}).then(fetchProject)} className="btn-sm btn-secondary">Вернуть в "Новые"</button>}
      </div>

      {user.role === 'Администратор' && project.status === 'active' && !isEditingPlan && task.status !== 'выполнена' && task.status !== 'отменена' && (
        <div style={{marginTop: '10px', display: 'flex', gap: '10px'}}>
          <select value={transferId} onChange={e => setTransferId(e.target.value)} style={{padding:'5px', borderRadius:'4px', border:'1px solid #ccc'}}>
            <option value="">Назначить прорабу...</option>
            {project.Users.filter(u=>u.Role.name==='Прораб').map(u=><option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
          <button onClick={() => { api.put(`/tasks/${task.id}/reassign`, {newUserId: transferId}).then(fetchProject); setTransferId(''); }} disabled={!transferId} className="btn-sm btn-info">Переназначить</button>
        </div>
      )}

      {task.status === 'новая' && canWork && !task.transferToUserId && (
        <div className={styles.transferControlsContainer}>
          <select value={transferId} onChange={e => setTransferId(e.target.value)} style={{padding:'5px', borderRadius:'4px', border:'1px solid #ccc'}}>
            <option value="">Передать прорабу...</option>
            {project.Users.filter(u=>u.Role.name==='Прораб' && u.id !== user.id).map(u=><option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
          <button onClick={() => { api.put(`/tasks/${task.id}/transfer`, {targetUserId: transferId}).then(fetchProject); setTransferId(''); }} className="btn-sm btn-primary" style={{marginLeft:'10px'}}>Отправить запрос</button>
        </div>
      )}

      {task.transferToUserId && task.assignedUserId === user.id && !isEditingPlan && project.status === 'active' && (
        <div className={styles.transferWaiting}>
          <small>Ждем ответа от {task.pendingTransferUser?.fullName}</small>
          <button onClick={() => api.put(`/tasks/${task.id}/transfer/cancel`).then(fetchProject)} className="btn-sm btn-danger" style={{marginLeft:'10px'}}>Отменить запрос</button>
        </div>
      )}

      {task.status === 'в работе' && canWork && (
        <div className={styles.completeTaskForm}>
          <textarea placeholder="Напишите отчет о проделанной работе..." defaultValue={task.reportText || ''} onChange={e=>setTaskReport(e.target.value)} className={styles.reportInput}/>
          <div className={styles.fileUploadWrapper}>
            <small style={{ display: 'block', color: '#555', marginBottom: '6px' }}>
              Не более 10 файлов, каждый до 10 МБ.
            </small>
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

      {(task.reportText || task.Attachments?.length > 0) && !isEditingPlan && (
        <div className={styles.taskReportBlock}>
          <strong>{task.status === 'выполнена' ? 'Отчет о выполнении:' : 'Прикрепленные файлы:'}</strong>
          {task.reportText && <p>{task.reportText}</p>}
          <div className={styles.attachments}>
            {task.Attachments?.map(a => (
              <div key={a.id} className={styles.attachmentItem}>
                {isImage(a.filePath) ? (
                  <img src={`${backendUrl}${a.filePath}`} alt="Отчет" onClick={() => setActivePhoto ? setActivePhoto(`${backendUrl}${a.filePath}`) : null} />
                ) : (
                  <a href={`${backendUrl}${a.filePath}`} target="_blank" rel="noreferrer" title={a.originalName}>📎 {a.originalName}</a>
                )}
                {canEditAttachments && (
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