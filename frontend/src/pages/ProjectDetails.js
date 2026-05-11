import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import styles from './ProjectDetails.module.css';

import ProjectHeader from '../components/project/ProjectHeader';
import Stage from '../components/project/Stage';
import ProjectChat from '../components/project/ProjectChat';
import ConfirmModal from '../components/common/ConfirmModal';
import { ROLES, PLAN_STATUSES } from '../utils/constants';

const socketUrl = process.env.NODE_ENV === 'production' ? '' : `http://${window.location.hostname}:5000`;
const socket = io(socketUrl);

const ProjectDetails = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  const [project, setProject] = useState(null);
  const [draftStages, setDraftStages] = useState(null);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, type: null, item: null });
  const [activePhoto, setActivePhoto] = useState(null);

  const [newStageName, setNewStageName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const fetchProject = useCallback(async () => {
    try {
      const res = await api.get('/projects');
      const found = res.data.find(p => p.id === parseInt(id));
      if (found) {
        found.ProjectStages.sort((a,b) => a.order - b.order);
        found.ProjectStages.forEach(s => { if(s.Tasks) s.Tasks.sort((a,b) => a.order - b.order); });
        setProject(found);
      }
    } catch (e) {}
  }, [id]);

  useEffect(() => {
    fetchProject();
  
    socket.emit('join_project', id);
  
    const handleStageUpdate = () => {
      fetchProject();
    };
  
    socket.on('stage_status_updated', handleStageUpdate);
  
    return () => {
      socket.emit('leave_project', id);
      socket.off('stage_status_updated', handleStageUpdate);
    };
  }, [id, fetchProject]);

  useEffect(() => {
    if (project && location.state?.scrollToTaskId) {
      const { scrollToTaskId } = location.state;
      const elementId = `task-${scrollToTaskId}`;
      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add(styles.highlight);
          setTimeout(() => element.classList.remove(styles.highlight), 2000);
          navigate(location.pathname, { replace: true, state: {} });
        }
      }, 500);
    }
  }, [project, location.state, location.pathname, navigate]);

  const startEditPlan = () => {
    setDraftStages(JSON.parse(JSON.stringify(project.ProjectStages)));
    setIsEditingPlan(true);
  };

  const cancelEditPlan = () => {
    setDraftStages(null);
    setIsEditingPlan(false);
  };

  const moveStage = (index, dir) => {
    const ns = [...draftStages];
    if (dir === 'up' && index > 0) [ns[index-1], ns[index]] = [ns[index], ns[index-1]];
    else if (dir === 'down' && index < ns.length-1) [ns[index+1], ns[index]] = [ns[index], ns[index+1]];
    setDraftStages(ns);
  };

  const moveTask = (stageId, taskIndex, dir) => {
    const ns = [...draftStages];
    const si = ns.findIndex(s => s.id === stageId);
    if (dir === 'up' && taskIndex > 0) [ns[si].Tasks[taskIndex-1], ns[si].Tasks[taskIndex]] = [ns[si].Tasks[taskIndex], ns[si].Tasks[taskIndex-1]];
    else if (dir === 'down' && taskIndex < ns[si].Tasks.length-1) [ns[si].Tasks[taskIndex+1], ns[si].Tasks[taskIndex]] = [ns[si].Tasks[taskIndex], ns[si].Tasks[taskIndex+1]];
    setDraftStages(ns);
  };

  const handleDraftStageEdit = (stageId, newStageData) => {
    const ns = [...draftStages];
    const index = ns.findIndex(s => s.id === stageId);
    if (index !== -1) {
      ns[index] = { ...ns[index], ...newStageData };
      setDraftStages(ns);
    }
  };

  const handleDraftTaskEdit = (stageId, taskId, newDesc) => {
    const ns = [...draftStages];
    const si = ns.findIndex(s => s.id === stageId);
    const ti = ns[si].Tasks.findIndex(t => t.id === taskId);
    if (si !== -1 && ti !== -1) {
      ns[si].Tasks[ti].description = newDesc;
      setDraftStages(ns);
    }
  };

  const removeDraftStage = (stageId) => {
    setDraftStages(draftStages.filter(s => s.id !== stageId));
  };

  const removeDraftTask = (stageId, taskId) => {
    const ns = [...draftStages];
    const si = ns.findIndex(s => s.id === stageId);
    ns[si].Tasks = ns[si].Tasks.filter(t => t.id !== taskId);
    setDraftStages(ns);
  };

  const handleAddStage = async () => {
    if(!newStageName.trim() || !newStart || !newEnd) return alert("Заполните все поля для нового этапа.");
    try {
      const res = await api.post('/tasks/stage', { projectId: id, name: newStageName, startDate: newStart, plannedEndDate: newEnd });
      const newStage = { ...res.data, Tasks: [] };
      setDraftStages([...draftStages, newStage]);
      setNewStageName(''); setNewStart(''); setNewEnd('');
    } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
  };

  const handleAddTaskToDraft = async (stageId, desc) => {
    if (!desc.trim()) return alert("Описание задачи не может быть пустым.");
    try {
      const res = await api.post('/tasks', { stageId, assignedUserId: user.id, description: desc });
      const ns = [...draftStages];
      const si = ns.findIndex(s => s.id === stageId);
      ns[si].Tasks.push(res.data);
      setDraftStages(ns);
    } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
  };

  const savePlanChanges = async () => {
    for (const stage of draftStages) {
      if (stage.Tasks.length === 0) {
        alert(`Этап "${stage.name}" не может быть пустым. Добавьте в него хотя бы одну задачу.`);
        return;
      }
      if (stage.Tasks.length > 50) {
        alert(`В этапе "${stage.name}" не может быть больше 50 задач.`);
        return;
      }
    }

    try {
      const originalStageIds = project.ProjectStages.map(s => s.id);
      const currentStageIds = draftStages.map(s => s.id);
      const stagesToDelete = originalStageIds.filter(id => !currentStageIds.includes(id));
      
      for (const sid of stagesToDelete) {
        await api.delete(`/tasks/stage/${sid}`);
      }

      for (const draftStage of draftStages) {
        const originalStage = project.ProjectStages.find(s => s.id === draftStage.id);

        if (!originalStage) { // Это новый этап, он уже создан
          continue;
        }

        const stageDataChanged =
          draftStage.name !== originalStage.name ||
          (draftStage.startDate?.split('T')[0] || '') !== (originalStage.startDate?.split('T')[0] || '') ||
          (draftStage.plannedEndDate?.split('T')[0] || '') !== (originalStage.plannedEndDate?.split('T')[0] || '');

        const tasksChanged = JSON.stringify(draftStage.Tasks.map(t => ({id: t.id, desc: t.description}))) !== JSON.stringify(originalStage.Tasks.map(t => ({id: t.id, desc: t.description})));

        if (stageDataChanged || tasksChanged) {
          await api.put(`/tasks/stage/${draftStage.id}/rename`, { 
            name: draftStage.name, 
            startDate: draftStage.startDate, 
            plannedEndDate: draftStage.plannedEndDate 
          });
        }
        
        for (const draftTask of draftStage.Tasks) {
          const originalTask = originalStage.Tasks.find(t => t.id === draftTask.id);
          if (originalTask && draftTask.description !== originalTask.description) {
            await api.put(`/tasks/${draftTask.id}/edit`, { description: draftTask.description });
          }
        }
        
        const originalTaskIds = originalStage.Tasks.map(t => t.id);
        const currentTaskIds = draftStage.Tasks.map(t => t.id);
        const tasksToDelete = originalTaskIds.filter(id => !currentTaskIds.includes(id));
        for (const tid of tasksToDelete) {
          await api.delete(`/tasks/${tid}`);
        }
      }

      await api.put(`/order/stages/project/${id}`, { orderedStageIds: currentStageIds });
      for (const s of draftStages) {
        await api.put(`/order/tasks/stage/${s.id}`, { orderedTaskIds: s.Tasks.map(t => t.id) });
      }
      
      await api.put(`/projects/${id}/plan-status`, { planStatus: PLAN_STATUSES.PENDING });
      setIsEditingPlan(false);
      fetchProject();
    } catch(e) { 
      alert(e.response?.data?.message || 'Ошибка сохранения'); 
    }
  };

  const confirmAction = async () => {
    const { type, item } = modalState;
    try {
      if (type === 'deleteAttachment') await api.delete(`/tasks/attachment/${item.id}`);
      else if (type === 'rejectTask') await api.put(`/tasks/${item.id}/reject`);
      else if (type === 'rejectStage') await api.put(`/tasks/stage/${item.id}/reject`);
      else if (type === 'submitPlan') await api.put(`/projects/${id}/plan-status`, { planStatus: 'pending_approval' });
      else if (type === 'finishProject') await api.put(`/projects/${id}/complete`);
      fetchProject();
    } catch(e) {}
    setModalState({ isOpen: false, type: null, item: null });
  };

  if (!project) return <div style={{textAlign: 'center', padding: '50px'}}>Загрузка...</div>;

  const activeStages = isEditingPlan ? draftStages : project.ProjectStages;
  const totalTasks = project.ProjectStages?.flatMap(s => s.Tasks) || [];
  const totalProgress = totalTasks.length === 0 ? 0 : Math.round((totalTasks.filter(t => t.status === 'выполнена').length / totalTasks.length) * 100);
  const pendingTransfers = totalTasks.filter(t => t.transferToUserId === user.id && t.status !== 'выполнена');

  const minDate = project.startDate?.split('T')[0];
  const maxDate = project.plannedEndDate?.split('T')[0];

  return (
    <div className={styles.container}>
      <ConfirmModal isOpen={modalState.isOpen} onClose={() => setModalState({ isOpen: false, type: null, item: null })} onConfirm={confirmAction} />
      <div className={styles.mainContent}>
        <button onClick={() => navigate(-1)} className={styles.backButton}>Назад</button>
        
        {pendingTransfers.length > 0 && !isEditingPlan && (
          <div className={styles.topAlertContainer}>
            {pendingTransfers.map(task => (
              <div key={task.id} className={styles.transferAlert}>
                <strong>Запрос на передачу задачи от {project.Users?.find(u=>u.id===task.assignedUserId)?.fullName}</strong>
                <p>"{task.description}"</p>
                <div style={{marginTop: '10px'}}>
                  <button onClick={() => api.put(`/tasks/${task.id}/transfer/accept`).then(fetchProject)} className="btn-sm btn-success" style={{marginRight: '10px'}}>Принять</button>
                  <button onClick={() => api.put(`/tasks/${task.id}/transfer/reject`).then(fetchProject)} className="btn-sm btn-danger">Отклонить</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ProjectHeader project={project} user={user} totalProgress={totalProgress} 
          allStagesApproved={project.ProjectStages.length > 0 && project.ProjectStages.every(s => s.status === 'утверждено')}
          onPlanSubmit={() => setModalState({ isOpen: true, type: 'submitPlan' })}
          onPlanStatusChange={(s) => api.put(`/projects/${id}/plan-status`, { planStatus: s }).then(fetchProject)}
          onProjectFinish={() => setModalState({ isOpen: true, type: 'finishProject' })}
        />

        <div className={styles.teamInfoBox}>
          <h4>Команда проекта:</h4>
          <ul className={styles.scrollTeam}>
            <li><strong>Заказчики:</strong> {project.Users.filter(u=>u.Role.name===ROLES.CLIENT).map(u=>u.fullName).join(', ')}</li>
            <li><strong>Прорабы:</strong> {project.Users.filter(u=>u.Role.name===ROLES.BUILDER).map(u=>u.fullName).join(', ')}</li>
          </ul>
        </div>

        {user.role === 'Прораб' && project.planStatus === 'pending_approval' && (
          <div className={styles.warningBanner}>Ожидается утверждение плана заказчиком. Выполнение работ приостановлено.</div>
        )}

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '15px'}}>
          <h2 style={{margin: 0}}>Структура работ</h2>
          {user.role === ROLES.BUILDER && project.status !== 'completed' && !isEditingPlan && (
            <button onClick={startEditPlan} className="btn-warning">Редактировать структуру</button>
          )}
          {isEditingPlan && (
            <div>
              <button onClick={savePlanChanges} className="btn-success" style={{marginRight:5}}>Сохранить и отправить на утверждение</button>
              <button onClick={cancelEditPlan} className="btn-danger">Отмена</button>
            </div>
          )}
        </div>

        {activeStages.map((stage, index) => (
          <div id={`stage-${stage.id}`} key={stage.id}>
            <Stage stage={stage} stageIndex={index} project={project} user={user} 
              isEditingPlan={isEditingPlan} moveStage={moveStage} moveTask={moveTask} 
              minDate={minDate} maxDate={maxDate} fetchProject={fetchProject} setModalState={setModalState} setActivePhoto={setActivePhoto}
              isFirstStage={index===0} isLastStage={index===activeStages.length-1}
              handleDraftStageEdit={handleDraftStageEdit} removeDraftStage={removeDraftStage}
              handleDraftTaskEdit={handleDraftTaskEdit} removeDraftTask={removeDraftTask} handleAddTaskToDraft={handleAddTaskToDraft}
            />
          </div>
        ))}

        {isEditingPlan && (
          <div className={`card ${styles.addStageForm}`}>
            <input type="text" placeholder="Название нового этапа" value={newStageName} onChange={e => setNewStageName(e.target.value)} style={{flex: 2}} />
            <input type="date" min={minDate} max={maxDate} value={newStart} onChange={e => setNewStart(e.target.value)} title="Начало" style={{flex: 1}} />
            <input type="date" min={minDate} max={maxDate} value={newEnd} onChange={e => setNewEnd(e.target.value)} title="Крайний срок" style={{flex: 1}} />
            <button onClick={handleAddStage} className="btn-success">Создать этап</button>
          </div>
        )}
      </div>
      <div className={styles.sidebar}><ProjectChat projectId={id} /></div>
      {activePhoto && (
        <div className={styles.lightboxOverlay} onClick={() => setActivePhoto(null)}>
          <img src={activePhoto} className={styles.lightboxImg} alt="Просмотр" />
          <div className={styles.lightboxClose}>&times;</div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;