import { describe, it, expect } from 'vitest';
import { renderLatex } from '../mathRender';

describe('renderLatex', () => {
  it('renders a simple expression to KaTeX HTML', () => {
    const { html, error } = renderLatex('E = mc^2');
    expect(error).toBeNull();
    expect(html).toContain('katex');
    expect(html).toContain('>m<');
    expect(html).toContain('>c<');
  });

  it('returns an error for empty input', () => {
    expect(renderLatex('   ')).toEqual({ html: '', error: 'Empty math block' });
  });

  it('returns an error for invalid LaTeX', () => {
    const { html, error } = renderLatex('\\notacommand{');
    expect(html).toBe('');
    expect(error).toBeTruthy();
  });
});
