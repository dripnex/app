import { useState, useEffect } from 'react';
import { URLS } from '@dripnex/product-config';
import logo from '../../../assets/logo.png';
import { SettingsPage } from '../components/SettingsPage';
import styles from './Section.module.css';

export function AboutSection() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    const result = window.dripnex?.app?.version?.();
    if (result !== undefined) {
      Promise.resolve(result)
        .then(setVersion)
        .catch(() => setVersion('Unknown'));
    }
  }, []);

  return (
    <SettingsPage title="About">
      <div className={styles.infoBlock}>
        <div className={styles.aboutBrand}>
          <img src={logo} alt="" className={styles.aboutLogo} width={48} height={48} />
          <div>
            <div className={styles.appName}>Dripnex</div>
            <div className={styles.version}>Version {version}</div>
          </div>
        </div>
      </div>

      <div className={styles.links}>
        <a href={URLS.website} target="_blank" rel="noopener noreferrer" className={styles.link}>
          dripnex.app
        </a>
        <a href={URLS.docs} target="_blank" rel="noopener noreferrer" className={styles.link}>
          Documentation
        </a>
        <a href={URLS.github} target="_blank" rel="noopener noreferrer" className={styles.link}>
          GitHub Repository
        </a>
      </div>
    </SettingsPage>
  );
}
