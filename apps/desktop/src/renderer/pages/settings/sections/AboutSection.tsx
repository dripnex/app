import { useState, useEffect } from 'react';
import styles from './Section.module.css';

export function AboutSection() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    const result = window.readied?.app?.version?.();
    if (result !== undefined) {
      Promise.resolve(result)
        .then(setVersion)
        .catch(() => setVersion('Unknown'));
    }
  }, []);

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>About</h2>

      <div className={styles.infoBlock}>
        <div className={styles.appName}>Readied</div>
        <div className={styles.version}>Version {version}</div>
      </div>

      <div className={styles.links}>
        <a
          href="https://github.com/tomymaritano/readide"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          GitHub Repository
        </a>
        <a
          href="https://tomymaritano.github.io/readide/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          Documentation
        </a>
      </div>
    </div>
  );
}
