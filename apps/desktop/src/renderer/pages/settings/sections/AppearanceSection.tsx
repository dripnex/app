import styles from './Section.module.css';

export function AppearanceSection() {
  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Appearance</h2>
      <p className={styles.placeholder}>
        Appearance settings coming soon...
      </p>
    </div>
  );
}
