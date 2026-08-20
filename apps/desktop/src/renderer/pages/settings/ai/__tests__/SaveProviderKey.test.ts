import { describe, expect, it } from 'vitest';
import { providerKeyItemTitle } from '../SaveProviderKey';

describe('providerKeyItemTitle', () => {
  it('namespaces the item under Dripnex', () => {
    expect(providerKeyItemTitle('Anthropic')).toBe('Dripnex · Anthropic');
    expect(providerKeyItemTitle('OpenAI')).toBe('Dripnex · OpenAI');
  });
});
