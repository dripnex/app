import katex from 'katex';

export function renderLatex(source: string): { html: string; error: string | null } {
  const trimmed = source.trim();
  if (!trimmed) {
    return { html: '', error: 'Empty math block' };
  }
  try {
    return {
      html: katex.renderToString(trimmed, {
        throwOnError: true,
        displayMode: true,
        output: 'html',
        trust: false,
      }),
      error: null,
    };
  } catch (err) {
    return {
      html: '',
      error: err instanceof Error ? err.message : 'Invalid LaTeX',
    };
  }
}
