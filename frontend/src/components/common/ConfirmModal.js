import React from 'react';
import styles from './ConfirmModal.module.css';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <h2>{title || 'Подтверждение'}</h2>
        <p>{message || 'Вы уверены, что хотите выполнить это действие?'}</p>
        <div className={styles.modalButtons}>
          <button onClick={onConfirm} className={styles.confirmButton}>Подтвердить</button>
          <button onClick={onClose} className={styles.cancelButton}>Отмена</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;