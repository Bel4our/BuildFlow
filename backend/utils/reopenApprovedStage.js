import { Task, ProjectStage } from '../models/index.js';

/** Этап в статусе «утверждено» считается договорённым составом работ — любые правки задач требуют повторной приёмки этапа. */
export async function reopenApprovedStageIfNeeded(stageId) {
  const stage = await ProjectStage.findByPk(stageId);
  if (!stage || stage.status !== 'утверждено') return false;

  stage.status = 'в работе';
  stage.actualEndDate = null;
  await stage.save();

  const tasks = await Task.findAll({ where: { stageId } });
  for (const t of tasks) {
    if (t.status === 'выполнена') {
      t.status = 'в работе';
      await t.save();
    }
  }
  return true;
}
