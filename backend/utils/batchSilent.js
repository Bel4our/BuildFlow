/** Промежуточные шаги пакетного сохранения плана: без Socket.IO и без Telegram до финального PUT plan-status */
export const isBatchSilent = (req) =>
  req.query.batchSilent === '1' ||
  req.query.batchSilent === 'true' ||
  req.body?.batchSilent === true;
