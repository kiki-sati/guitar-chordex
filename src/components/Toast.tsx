import styles from './Toast.module.css';

interface ToastProps {
  message: string;
}

/** 토스트 (원본 라인 165-167). */
export function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div className={styles.toast} role="status">
      {message}
    </div>
  );
}
