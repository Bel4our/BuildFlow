import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import Task from './Task';
import styles from '../../pages/ProjectDetails.module.css';

const Stage = ({ stage, stageIndex, project, user, isEditingPlan, moveStage, moveTask, minDate, maxDate, fetchProject, setModalState, setActivePhoto, isFirstStage, isLastStage, handleDraftStageEdit, removeDraftStage, handleDraftTaskEdit, removeDraftTask, handleAddTaskToDraft }) => {
  const [editName, setEditName] = useState(stage.name);
  const [editStart, setEditStart] = useState(stage.startDate?.split('T')[0] || '');
  const [editEnd, setEditEnd] = useState(stage.plannedEndDate?.split('T')[0] || '');
  const [newTaskDesc, setNewTaskDesc] = useState('');

  useEffect(() => {
    if (isEditingPlan) {
      handleDraftStageEdit(stage.id, { name: editName, startDate: editStart, plannedEndDate: editEnd });
    }
  }, [editName, editStart, editEnd]);

  const stageProgress = stage.Tasks?.length ? Math.round((stage.Tasks.filter(t => t.status === 'выполнена').length / stage.Tasks.length) * 100) : 0;
  const isPending = user.role === 'Заказчик' && project.planStatus === 'pending_approval' && stage.status !== 'утверждено';
  const allDone = stage.Tasks?.length > 0 ? stage.Tasks.every(t => t.status === 'выполнена') : true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const plannedEnd = stage.plannedEndDate ? new Date(stage.plannedEndDate) : null;
  if (plannedEnd) plannedEnd.setHours(0, 0, 0, 0);

  const isOverdueNow = !isEditingPlan && stage.status !== 'утверждено' && plannedEnd && plannedEnd < today;
  const wasCompletedLate = stage.status === 'утверждено' && stage.actualEndDate && plannedEnd && new Date(stage.actualEndDate) > plannedEnd;

  return (
    <div className={`card ${styles.stageCard} ${isPending ? styles.highlightPending : ''}`}>
      <div className={styles.stageHeaderWrapper}>
        <div className={styles.stageTitleBlock}>
          {isEditingPlan ? (
            <div className={styles.inlineEditForm}>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={{flex: 2}} />
              <input type="date" min={minDate} max={maxDate} value={editStart} onChange={e => setEditStart(e.target.value)} style={{flex: 1}} title="Начало" />
              <input type="date" min={minDate} max={maxDate} value={editEnd} onChange={e => setEditEnd(e.target.value)} style={{flex: 1}} title="Конец" />
            </div>
          ) : (
            <>
              <h3>{stage.name}</h3>
              <span className={styles.deadline}>Сроки: {stage.startDate?.split('T')[0]} - {stage.plannedEndDate?.split('T')[0]}</span>
              {isOverdueNow && <span className={styles.overdue}>ПРОСРОЧЕНО</span>}
              {stage.status === 'утверждено' && (
                <div>
                  <span className={styles.onTime}>Выполнено</span>
                  {wasCompletedLate && <span className={styles.overdue} style={{marginLeft: '5px'}}>(с опозданием)</span>}
                  {stage.actualEndDate && <small className={styles.deadline}> (Принят: {new Date(stage.actualEndDate).toLocaleDateString('ru-RU')})</small>}
                </div>
              )}
            </>
          )}
        </div>
        {isEditingPlan && (
          <div className={styles.stageActions}>
            <div className={styles.orderButtons}>
              <button onClick={() => moveStage(stageIndex, 'up')} disabled={isFirstStage}>↑</button>
              <button onClick={() => moveStage(stageIndex, 'down')} disabled={isLastStage}>↓</button>
            </div>
            <button onClick={() => removeDraftStage(stage.id)} className={`${styles.actionLink} ${styles.actionLinkDanger}`}>✕</button>
          </div>
        )}
      </div>

      <div className={styles.stageProgress}>
        <div className="progress-container"><div className="progress-bar" style={{ width: `${stageProgress}%` }}></div></div>
        <span>{stageProgress}%</span>
      </div>

      <div className={styles.tasksContainer}>
        {stage.Tasks?.map((task, index) => (
          <div id={`task-${task.id}`} key={task.id}>
            <Task task={task} taskIndex={index} stage={stage} project={project} user={user} 
              isEditingPlan={isEditingPlan} moveTask={moveTask} fetchProject={fetchProject} setModalState={setModalState} setActivePhoto={setActivePhoto}
              isFirstTask={index === 0} isLastTask={index === stage.Tasks.length - 1}
              handleDraftTaskEdit={handleDraftTaskEdit} removeDraftTask={removeDraftTask}
            />
          </div>
        ))}
      </div>

      {isEditingPlan && (
        <div className={styles.addTaskForm} style={{marginTop: 10}}>
          <input type="text" placeholder="Описание новой задачи..." value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
          <button onClick={() => { if(newTaskDesc.trim()) { handleAddTaskToDraft(stage.id, newTaskDesc); setNewTaskDesc(''); } }} className="btn-info">+ Задача</button>
        </div>
      )}

      {user.role === 'Прораб' && !isEditingPlan && allDone && project.planStatus === 'approved' && project.status === 'active' && (
        <div style={{marginTop: '10px'}}>
          {stage.status !== 'ожидает утверждения' && stage.status !== 'утверждено' && (
            <button onClick={() => api.put(`/tasks/stage/${stage.id}/request-approval`).then(fetchProject)} className="btn-primary">Запросить приемку этапа</button>
          )}
          {stage.status === 'ожидает утверждения' && (
            <button onClick={() => api.put(`/tasks/stage/${stage.id}/cancel-approval`).then(fetchProject)} className="btn-warning">Отменить запрос на приемку</button>
          )}
        </div>
      )}

      {user.role === 'Заказчик' && project.planStatus === 'approved' && project.status === 'active' && stage.status === 'ожидает утверждения' && (
        <div className={styles.actionButtons}>
          <button onClick={() => api.put(`/tasks/stage/${stage.id}/approve`).then(fetchProject)} disabled={!allDone} className="btn-success" style={{ flex: 2, opacity: allDone ? 1 : 0.6, cursor: allDone ? 'pointer' : 'not-allowed' }}>
            {allDone ? 'Утвердить этап (Принять работу)' : 'Ожидайте выполнения всех задач...'}
          </button>
          {allDone && <button onClick={() => setModalState({ isOpen: true, type: 'rejectStage', item: stage })} className="btn-danger">Отклонить</button>}
        </div>
      )}
      {stage.status === 'утверждено' && <div className={styles.stageApproved}>Этап утвержден заказчиком</div>}
    </div>
  );
};
export default Stage;