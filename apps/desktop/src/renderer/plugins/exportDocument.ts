function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Capture the rendered preview body, minus the metadata header. */
export function capturePreviewHtml(): string | null {
  const body = document.querySelector('[data-preview-body]');
  if (body && body.innerHTML.trim()) return body.innerHTML;
  return null;
}

export function buildPrintDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    max-width: 44rem;
    margin: 2rem auto;
    padding: 0 1.5rem 3rem;
    line-height: 1.65;
    color: #1a1a1a;
    background: #fff;
  }
  h1, h2, h3, h4 { line-height: 1.25; }
  pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  pre { padding: 12px 16px; background: #f4f4f5; border-radius: 8px; overflow-x: auto; }
  code { background: #f4f4f5; padding: 0.1em 0.35em; border-radius: 4px; }
  pre code { background: none; padding: 0; }
  blockquote { margin: 1em 0; padding: 0.5em 1em; border-left: 3px solid #737373; color: #525252; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d4d4d4; padding: 6px 10px; text-align: left; }
  img { max-width: 100%; }
  .markdown-alert { font-style: normal; border-left-width: 4px; border-radius: 0 6px 6px 0; padding: 0.75em 1em; }
  .markdown-alert-title { font-weight: 650; margin: 0 0 0.35em; }
  .markdown-alert-note { border-left-color: #4493f8; background: #eff6ff; }
  .markdown-alert-tip { border-left-color: #3fb950; background: #f0fdf4; }
  .markdown-alert-important { border-left-color: #ab7df8; background: #faf5ff; }
  .markdown-alert-warning { border-left-color: #d29922; background: #fffbeb; }
  .markdown-alert-caution { border-left-color: #f85149; background: #fef2f2; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</body>
</html>`;
}
