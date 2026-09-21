import { ProjectStage, Task } from '../models/index.js';
import sequelize from '../config/db.js';
import { triggerReapproval } from '../services/planService.js';
import { isBatchSilent } from '../utils/batchSilent.js';

export const updateStageOrder = async (req, res) => {
  const { orderedStageIds } = req.body;
  const { projectId } = req.params;
  const silent = isBatchSilent(req);
  const t = await sequelize.transaction();
  try {
    for (let i = 0; i < orderedStageIds.length; i++) {
      await ProjectStage.update(
        { order: i },
        { where: { id: orderedStageIds[i], projectId: projectId }, transaction: t }
      );
    }
    await t.commit();
    if (!silent) await triggerReapproval(projectId);
    
    if (!silent) req.io.to(projectId.toString()).emit('stage_status_updated');
    res.json({ message: 'Порядок этапов обновлен' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: 'Ошибка обновления порядка этапов' });
  }
};

import { reopenApprovedStageIfNeeded } from '../utils/reopenApprovedStage.js';

export const updateTaskOrder = async (req, res) => {
  const { orderedTaskIds } = req.body;
  const { stageId } = req.params;
  const silent = isBatchSilent(req);
  const t = await sequelize.transaction();
  try {
    for (let i = 0; i < orderedTaskIds.length; i++) {
      await Task.update(
        { order: i },
        { where: { id: orderedTaskIds[i], stageId: stageId }, transaction: t }
      );
    }
    await t.commit();
    await reopenApprovedStageIfNeeded(parseInt(stageId, 10));
    const stage = await ProjectStage.findByPk(stageId);
    if (stage) {
      if (!silent) await triggerReapproval(stage.projectId);
      if (!silent) req.io.to(stage.projectId.toString()).emit('stage_status_updated');
    }
    
    res.json({ message: 'Порядок задач обновлен' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: 'Ошибка обновления порядка задач' });
  }
};