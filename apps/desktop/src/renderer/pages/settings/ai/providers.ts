import type { AiSettings } from '../../../stores/settings/schema';

export type AiProviderId = AiSettings['provider'];

export interface ProviderCatalogItem {
  id: AiProviderId;
  name: string;
  kind: 'included' | 'cloud' | 'local';
  description: string;
  keyUrl: string;
  placeholder: string;
  hint: string;
  /** Shown when this install has no product-owned key. */
  unavailableHint?: string;
}

export const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  {
    id: 'dripnex',
    name: 'Dripnex AI',
    kind: 'included',
    description: 'Authorize once with your Dripnex account. Hosted Claude, billed to us.',
    keyUrl: '',
    placeholder: '',
    hint: 'Official builds include a product key. Same models as Anthropic.',
    unavailableHint:
      'This install has no product key. Use Anthropic with your own key, or Ollama on this machine.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'cloud',
    description: 'Claude — Sonnet, Opus, Haiku.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-api03-…',
    hint: 'Key stays in the system keychain. Never in the note file.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'cloud',
    description: 'GPT-4o, o1, and local-index embeddings.',
    keyUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-proj-…',
    hint: 'Same key can power chat and embeddings.',
  },
  {
    id: 'grok',
    name: 'Grok',
    kind: 'cloud',
    description: 'xAI Grok 4 and Grok 3.',
    keyUrl: 'https://console.x.ai/',
    placeholder: 'xai-…',
    hint: 'Create a key in the xAI console.',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    kind: 'local',
    description: 'Runs on this machine. No API key.',
    keyUrl: 'https://ollama.com/download',
    placeholder: 'http://127.0.0.1:11434',
    hint: 'Start Ollama, then Connect. Models are whatever you have pulled.',
  },
];

export const FALLBACK_MODELS: Record<AiProviderId, Array<{ value: string; label: string }>> = {
  dripnex: [
    { value: 'claude-sonnet-5', label: 'Dripnex Sonnet' },
    { value: 'claude-haiku-4-5-20251001', label: 'Dripnex Haiku' },
    { value: 'claude-opus-4-8', label: 'Dripnex Opus' },
  ],
  anthropic: [
    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o1', label: 'o1' },
    { value: 'o1-mini', label: 'o1 Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  grok: [
    { value: 'grok-4', label: 'Grok 4' },
    { value: 'grok-3', label: 'Grok 3' },
    { value: 'grok-3-mini', label: 'Grok 3 Mini' },
  ],
  ollama: [],
};
