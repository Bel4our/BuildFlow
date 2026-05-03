import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import styles from './ProjectDetails.module.css';

import ProjectHeader from '../components/project/ProjectHeader';
import Stage from '../components/project/Stage';
import ProjectChat from '../components/project/ProjectChat';
import ConfirmModal from '../components/common/ConfirmModal';

const ProjectDetails = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [newStageName, setNewStageName] = useState('');
  const [newStageDeadline, setNewStageDeadline] = useState('');
  const [modalState, setModalState] = useState({ isOpen: false, type: null, item: null });
  const [activePhoto, setActivePhoto] = useState(null);
  const hasScrolled = useRef(false);

  const fetchProject = useCallback(async () => {
    try {
        const res = await api.get('/projects');
        const found = res.data.find(p => p.id === parseInt(id));
        if (found) {
          found.ProjectStages.sort((a,b) => a.order - b.order);
          found.ProjectStages.forEach(stage => {
            if (stage.Tasks) stage.Tasks.sort((a,b) => a.order - b.order);
          });
          setProject(found);
        }
    } catch (error) {}
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    if (project && window.location.hash && !hasScrolled.current) {
      hasScrolled.current = true;
      const elementId = window.location.hash.substring(1);
      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add(styles.highlight);
          setTimeout(() => element.classList.remove(styles.highlight), 2000);
          window.history.replaceState(null, '', window.location.pathname);
        }
      }, 500);
    }
  }, [project]);

  const moveStage = async (index, direction) => {
    const newStages = [...project.ProjectStages];
    if (direction === 'up' && index > 0) {
      [newStages[index - 1], newStages[index]] = [newStages[index], newStages[index - 1]];
    } else if (direction === 'down' && index < newStages.length - 1) {
      [newStages[index + 1], newStages[index]] = [newStages[index], newStages[index + 1]];
    } else return;

    setProject({ ...project, ProjectStages: newStages });
    await api.put(`/order/stages/project/${id}`, { orderedStageIds: newStages.map(s => s.id) });
    fetchProject();
  };

  const moveTask = async (stageId, taskIndex, direction) => {
    const stageIndex = project.ProjectStages.findIndex(s => s.id === stageId);
    const newTasks = [...project.ProjectStages[stageIndex].Tasks];
    if (direction === 'up' && taskIndex > 0) {
      [newTasks[taskIndex - 1], newTasks[taskIndex]] = [newTasks[taskIndex], newTasks[taskIndex - 1]];
    } else if (direction === 'down' && taskIndex < newTasks.length - 1) {
      [newTasks[taskIndex + 1], newTasks[taskIndex]] = [newTasks[taskIndex], newTasks[taskIndex + 1]];
    } else return;

    const updatedProject = { ...project };
    updatedProject.ProjectStages[stageIndex].Tasks = newTasks;
    setProject(updatedProject);
    await api.put(`/order/tasks/stage/${stageId}`, { orderedTaskIds: newTasks.map(t => t.id) });
    fetchProject();
  };

  const handleAddStage = async () => {
    if(!newStageName) return; 
    try {
      await api.post('/tasks/stage', { projectId: id, name: newStageName, plannedEndDate: newStageDeadline || null });
      setNewStageName(''); setNewStageDeadline('');
      fetchProject();
    } catch(err) { alert(err.response?.data?.message || 'Ошибка'); }
  };

  const confirmAction = async () => {
    const { type, item } = modalState;
    try {
      if (type === 'deleteStage') await api.delete(`/tasks/stage/${item.id}`);
      else if (type === 'deleteTask') await api.delete(`/tasks/${item.id}`);
      else if (type === 'deleteAttachment') await api.delete(`/tasks/attachment/${item.id}`);
      else if (type === 'rejectTask') await api.put(`/tasks/${item.id}/reject`);
      else if (type === 'rejectStage') await api.put(`/tasks/stage/${item.id}/reject`);
      else if (type === 'submitPlan') await api.put(`/projects/${id}/plan-status`, { planStatus: 'pending_approval' });
      else if (type === 'finishProject') await api.put(`/projects/${id}/complete`);
      fetchProject();
    } catch(err) { alert('Ошибка'); }
    setModalState({ isOpen: false, type: null, item: null });
  };

  if (!project) return <div style={{textAlign: 'center', padding: '50px'}}>Загрузка...</div>;

  const totalTasks = project.ProjectStages?.flatMap(s => s.Tasks) || [];
  const totalProgress = totalTasks.length === 0 ? 0 : Math.round((totalTasks.filter(t => t.status === 'выполнена').length / totalTasks.length) * 100);
  const pendingTransfers = totalTasks.filter(t => t.transferToUserId === user.id && t.status !== 'выполнена');

  return (
    <div className={styles.container}>
      <ConfirmModal isOpen={modalState.isOpen} onClose={() => setModalState({ isOpen: false, type: null, item: null })} onConfirm={confirmAction} />
      <div className={styles.mainContent}>
        <button onClick={() => navigate(-1)} className={styles.backButton}>Назад</button>
        
        {pendingTransfers.length > 0 && (
          <div className={styles.topAlertContainer}>
            {pendingTransfers.map(task => (
              <div key={task.id} className={styles.transferAlert}>
                <strong>Запрос на передачу задачи в проекте "{project.name}" от {project.Users?.find(u=>u.id===task.assignedUserId)?.fullName}</strong>
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
          <p><strong>Заказчики:</strong> {project.Users.filter(u=>u.Role.name==='Заказчик').map(u=>u.fullName).join(', ')}</p>
          <p><strong>Прорабы:</strong> {project.Users.filter(u=>u.Role.name==='Прораб').map(u=>u.fullName).join(', ')}</p>
        </div>

        {user.role === 'Прораб' && project.planStatus === 'pending_approval' && (
          <div className={styles.warningBanner}>Ожидается утверждение плана заказчиком. Выполнение работ приостановлено.</div>
        )}

        <div>
          {project.ProjectStages.map((stage, index) => (
            <Stage key={stage.id} stage={stage} stageIndex={index} project={project} user={user} 
              onStageDelete={(id) => setModalState({ isOpen: true, type: 'deleteStage', item: {id} })}
              onStageEdit={(id, data) => api.put(`/tasks/stage/${id}/rename`, data).then(fetchProject)}
              onTaskCreate={(sid, desc) => api.post('/tasks', { stageId: sid, assignedUserId: user.id, description: desc }).then(fetchProject)}
              fetchProject={fetchProject} setModalState={setModalState} moveStage={moveStage} moveTask={moveTask}
              isFirstStage={index === 0} isLastStage={index === project.ProjectStages.length - 1}
              minDate={project.startDate?.split('T')[0]} maxDate={project.plannedEndDate?.split('T')[0]}
              setActivePhoto={setActivePhoto}
            />
          ))}
        </div>

        {user.role === 'Прораб' && project.status !== 'completed' && (
          <div className={`card ${styles.addStageForm}`}>
            <input type="text" placeholder="Название нового этапа" value={newStageName} onChange={e => setNewStageName(e.target.value)} style={{flex: 2}} />
            <input type="date" min={project.startDate?.split('T')[0]} max={project.plannedEndDate?.split('T')[0]} value={newStageDeadline} onChange={e => setNewStageDeadline(e.target.value)} style={{flex: 1}} />
            <button onClick={handleAddStage}>Создать этап</button>
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