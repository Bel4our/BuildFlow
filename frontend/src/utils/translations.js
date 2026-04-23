export const translatePlanStatus = (status) => {
  const statuses = {
    draft: 'Черновик',
    pending_approval: 'Ожидает утверждения',
    approved: 'Утверждён',
    rejected: 'Отклонен'
  };
  return statuses[status] || status;
};

export const translateTaskStatus = (status) => {
  const statuses = {
    'новая': 'Новая',
    'в работе': 'В работе',
    'выполнена': 'Выполнена'
  };
  return statuses[status] || status;
};