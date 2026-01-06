import styles from './Section.module.css';

export function GeneralSection() {
  return (
    <div className={styles.section}>
      <h2 className={styles.title}>General</h2>
      <p className={styles.placeholder}>
        General settings coming soon...
      </p>
    </div>
  );
}
