import styles from './RecoveryDialog.module.css'

interface RecoveryDialogProps {
  snapshotName: string
  onAccept: () => void
  onDecline: () => void
}

export function RecoveryDialog({ snapshotName, onAccept, onDecline }: RecoveryDialogProps) {
  const date = snapshotName.slice(0, 19).replace('T', ' ')

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h2>Recuperação de sessão</h2>
        <p>
          Foi encontrado um backup automático mais recente que o último arquivo salvo,
          datado de <strong>{date}</strong>.
        </p>
        <p>Deseja restaurar essa versão?</p>
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={onAccept}>
            Restaurar backup
          </button>
          <button className={styles.btnSecondary} onClick={onDecline}>
            Abrir versão salva
          </button>
        </div>
      </div>
    </div>
  )
}
