import styles from './sidebar.module.css';

/** Resolve one or more sidebar module class names. Falsy values are skipped. */
export function sc(...names: Array<string | false | null | undefined>): string {
  return names.flatMap(name => (name && styles[name] ? [styles[name]] : [])).join(' ');
}
