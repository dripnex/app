import type { AiProviderId } from './providers';
import dripnexMark from '../../../assets/logo.png';
import anthropicLogo from '@lobehub/icons-static-svg/icons/anthropic.svg';
import openaiLogo from '@lobehub/icons-static-svg/icons/openai.svg';
import grokLogo from '@lobehub/icons-static-svg/icons/grok.svg';
import ollamaLogo from '@lobehub/icons-static-svg/icons/ollama.svg';
import styles from './ProviderMark.module.css';

const LOGOS: Record<Exclude<AiProviderId, 'dripnex'>, string> = {
  anthropic: anthropicLogo,
  openai: openaiLogo,
  grok: grokLogo,
  ollama: ollamaLogo,
};

export function ProviderMark({ id, size = 36 }: { id: AiProviderId; size?: number }) {
  return (
    <span
      className={styles.mark}
      data-id={id}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {id === 'dripnex' ? (
        <img className={styles.photo} src={dripnexMark} alt="" />
      ) : (
        <img className={styles.iconImg} src={LOGOS[id]} alt="" />
      )}
    </span>
  );
}
