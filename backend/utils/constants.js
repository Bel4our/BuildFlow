export const ROLES = { ADMIN: 'Администратор', CLIENT: 'Заказчик', BUILDER: 'Прораб', GUEST: 'Гость' };
export const PROJECT_STATUSES = { ACTIVE: 'active', COMPLETED: 'completed', SUSPENDED: 'suspended' };
export const PLAN_STATUSES = { DRAFT: 'draft', PENDING: 'pending_approval', APPROVED: 'approved', REJECTED: 'rejected' };
export const TASK_STATUSES = { NEW: 'новая', IN_PROGRESS: 'в работе', DONE: 'выполнена' };
export const STAGE_STATUSES = { IN_PROGRESS: 'в работе', APPROVED: 'утверждено' };
export const PASS_REGEX = /^(?=.*[a-zA-Zа-яА-ЯёЁ])(?=.*\d)(?=.*[^a-zA-Zа-яА-ЯёЁ0-9]).{8,50}$/;