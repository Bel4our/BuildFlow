import React, { useState } from 'react';
import api from '../../api/axios';
import Task from './Task';
import styles from '../../pages/ProjectDetails.module.css';

const Stage = ({ stage, stageIndex, project, user, onStageDelete, onStageEdit, onTaskCreate, fetchProject, setModalState, moveStage, moveTask, isFirstStage, isLastStage, minDate, maxDate, setActivePhoto }) => {
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(stage.name);
  const [editDate, setEditDate] = useState(stage.plannedEndDate ? stage.plannedEndDate.split('T')[0] : '');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const stageProgress = stage.Tasks?.length ? Math.round((stage.Tasks.filter(t => t.status === 'выполнена').length / stage.Tasks.length) * 100) : 0;
  const canEdit = user.role === 'Прораб' && project.status !== 'completed' && stage.status !== 'утверждено';
  const isPending = user.role === 'Заказчик' && project.planStatus === 'pending_approval' && stage.status !== 'утверждено';
  
  const allDone = stage.Tasks?.length > 0 ? stage.Tasks.every(t => t.status === 'выполнена') : true;

  return (
    <div className={`card ${styles.stageCard} ${isPending ? styles.highlightPending : ''}`}>
      {editMode ? (
        <div className={styles.inlineEditForm}>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={{flex: 2}} />
          <input type="date" min={minDate} max={maxDate} value={editDate} onChange={e => setEditDate(e.target.value)} style={{flex: 1}} />
          <button onClick={() => { onStageEdit(stage.id, {name: editName, plannedEndDate: editDate}); setEditMode(false); }} className="btn-sm btn-success">Сохранить</button>
          <button onClick={() => setEditMode(false)} className="btn-sm btn-danger">Отмена</button>
        </div>
      ) : (
        <div className={styles.stageHeaderWrapper}>
          <div className={styles.stageTitleBlock}>
            <h3>{stage.name}</h3>
            {stage.plannedEndDate && <span className={styles.deadline}>Срок: {new Date(stage.plannedEndDate).toLocaleDateString('ru-RU')}</span>}
            {stage.status === 'утверждено' && <span className={styles.onTime}>Выполнено</span>}
          </div>
          {canEdit && (
            <div className={styles.stageActions}>
              <div className={styles.orderButtons}>
                <button onClick={() => moveStage(stageIndex, 'up')} disabled={isFirstStage}>↑</button>
                <button onClick={() => moveStage(stageIndex, 'down')} disabled={isLastStage}>↓</button>
              </div>
              <button onClick={() => setEditMode(true)} className={styles.actionLink}>✏️</button>
              <button onClick={() => onStageDelete(stage.id)} className={`${styles.actionLink} ${styles.actionLinkDanger}`}>✕</button>
            </div>
          )}
        </div>
      )}
      
      <div className={styles.stageProgress}>
        <div className="progress-container"><div className="progress-bar" style={{ width: `${stageProgress}%` }}></div></div>
        <span>{stageProgress}%</span>
      </div>

      <div className={styles.tasksContainer}>
        {stage.Tasks?.map((task, index) => (
          <Task key={task.id} task={task} taskIndex={index} stage={stage} project={project} user={user} 
            fetchProject={fetchProject} setModalState={setModalState} setActivePhoto={setActivePhoto} moveTask={moveTask}
            isFirstTask={index === 0} isLastTask={index === stage.Tasks.length - 1}
          />
        ))}
      </div>

      {canEdit && (
        <div className={styles.addTaskContainer}>
          {addingTask ? (
            <div className={styles.addTaskForm}>
              <input type="text" placeholder="Описание задачи..." value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
              <button onClick={() => { onTaskCreate(stage.id, newTaskDesc); setNewTaskDesc(''); setAddingTask(false); }}>Добавить</button>
              <button onClick={() => setAddingTask(false)} className="btn-danger">Отмена</button>
            </div>
          ) : <button onClick={() => setAddingTask(true)} className="btn-info">+ Добавить задачу</button>}
        </div>
      )}

      {user.role === 'Заказчик' && project.planStatus === 'approved' && stage.status !== 'утверждено' && project.status !== 'completed' && (
        <div className={styles.actionButtons}>
          <button 
            onClick={() => api.put(`/tasks/stage/${stage.id}/approve`).then(fetchProject)} 
            disabled={!allDone} 
            className="btn-success" 
            style={{ flex: 2, opacity: allDone ? 1 : 0.6, cursor: allDone ? 'pointer' : 'not-allowed' }}
          >
            {allDone ? 'Утвердить этап ' : 'Ожидайте выполнения всех задач...'}
          </button>
          {allDone && (<button onClick={() => setModalState({ isOpen: true, type: 'rejectStage', item: stage })} className="btn-danger">Отклонить</button>)}
        </div>
      )}
      {stage.status === 'утверждено' && <div className={styles.stageApproved}>Этап утвержден заказчиком</div>}
    </div>
  );
};

export default Stage;