import React from 'react';
import { translatePlanStatus } from '../../utils/translations';
import styles from '../../pages/ProjectDetails.module.css';

const ProjectHeader = ({ project, user, totalProgress, allStagesApproved, onPlanSubmit, onPlanStatusChange, onProjectFinish }) => {
  const getPlanStatusClass = (status) => {
    const classes = { draft: styles.planDraft, pending_approval: styles.planPending, rejected: styles.planRejected, approved: styles.planApproved };
    return classes[status] || '';
  };

  const startDate = project.startDate ? new Date(project.startDate).toLocaleDateString('ru-RU') : '...';
  const endDate = project.plannedEndDate ? new Date(project.plannedEndDate).toLocaleDateString('ru-RU') : '...';

  return (
    <div className={`card ${project.status === 'completed' ? styles.projectCompletedBorder : ''}`}>
      <div className={styles.stageHeaderWrapper}>
        <div className={styles.stageTitleBlock}>
          <h1 className={project.status === 'completed' ? styles.projectCompletedTitle : ''}>
            {project.name} {project.status === 'completed' && '(ЗАВЕРШЕН)'}
          </h1>
          <span className={styles.deadline}>Сроки проекта: с {startDate} по {endDate}</span>
          {project.status === 'completed' && <span className={styles.onTime}>Завершен</span>}
        </div>
      </div>
      <p className={styles.projectDescription}>{project.description}</p>
      <div className={styles.progressSection}>
        <div className={styles.progressHeader}><strong>Общий прогресс:</strong><strong>{totalProgress}%</strong></div>
        <div className="progress-container"><div className="progress-bar" style={{ width: `${totalProgress}%` }}></div></div>
      </div>
      <div className={`${styles.planStatus} ${getPlanStatusClass(project.planStatus)}`}>
        Статус плана: {translatePlanStatus(project.planStatus)}
      </div>
      {user.role === 'Прораб' && project.planStatus !== 'approved' && project.planStatus !== 'pending_approval' && project.status !== 'completed' && project.ProjectStages?.length > 0 && (
        <button onClick={onPlanSubmit} className={styles.submitPlanButton}>ОТПРАВИТЬ ПЛАН НА УТВЕРЖДЕНИЕ</button>
      )}
      {user.role === 'Заказчик' && project.planStatus === 'pending_approval' && (
        <div className={styles.actionButtons}>
          <button onClick={() => onPlanStatusChange('approved')} className="btn-success">УТВЕРДИТЬ ПЛАН</button>
          <button onClick={() => onPlanStatusChange('rejected')} className="btn-danger">ОТКЛОНИТЬ ПЛАН</button>
        </div>
      )}
      
      {user.role === 'Заказчик' && project.status === 'active' && allStagesApproved && (
        <button onClick={onProjectFinish} className={styles.finishProjectButton} style={{fontSize: '1.2em', padding: '20px', marginTop: '20px'}}>
          ПРИНЯТЬ ГОТОВЫЙ ОБЪЕКТ
        </button>
      )}
    </div>
  );
};

export default ProjectHeader;