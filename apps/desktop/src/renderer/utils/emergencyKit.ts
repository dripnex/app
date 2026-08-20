import { formatRecoveryKey } from './passphrase';

export interface EmergencyKitFields {
  email?: string | null;
  passphrase?: string | null;
  recoveryKey?: string | null;
  createdAt?: Date;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderEmergencyKitHtml(fields: EmergencyKitFields): string {
  const created = (fields.createdAt ?? new Date()).toISOString().slice(0, 10);
  const email = fields.email?.trim() || '________________';
  const passphrase = fields.passphrase?.trim() || '';
  const recovery = fields.recoveryKey ? formatRecoveryKey(fields.recoveryKey) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Dripnex Emergency Kit</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #111;
      background: #fff;
    }
    .page { max-width: 720px; margin: 0 auto; padding: 28px 32px; }
    .kicker {
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #666;
      margin: 0 0 6px;
    }
    h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -0.03em; }
    .lede { margin: 0 0 22px; color: #444; line-height: 1.45; font-size: 14px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 22px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin: 0 0 4px; }
    .value { margin: 0; font-size: 15px; }
    .box {
      border: 1px solid #111;
      border-radius: 8px;
      padding: 14px 16px;
      margin: 0 0 14px;
    }
    .secret {
      margin: 8px 0 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 18px;
      line-height: 1.5;
      word-break: break-word;
    }
    .blank {
      margin-top: 10px;
      border-bottom: 1px solid #111;
      height: 28px;
    }
    .warn {
      font-size: 12px;
      color: #444;
      line-height: 1.45;
      margin: 16px 0 0;
    }
    ul { margin: 8px 0 0; padding-left: 18px; }
    li { margin: 4px 0; }
    @media print {
      .page { padding: 0; }
    }
  </style>
</head>
<body>
  <article class="page">
    <p class="kicker">Dripnex</p>
    <h1>Emergency Kit</h1>
    <p class="lede">
      Use this page to unlock sync on a new device, or if you forget your passphrase.
      Store a printed copy offline. Anyone with this sheet can decrypt your synced notes.
    </p>
    <div class="meta">
      <div>
        <p class="label">Account email</p>
        <p class="value">${escapeHtml(email)}</p>
      </div>
      <div>
        <p class="label">Created</p>
        <p class="value">${escapeHtml(created)}</p>
      </div>
      <div>
        <p class="label">Sign-in</p>
        <p class="value">dripnex.app</p>
      </div>
      <div>
        <p class="label">App</p>
        <p class="value">Dripnex desktop</p>
      </div>
    </div>
    <section class="box">
      <p class="label">Sync passphrase</p>
      ${
        passphrase
          ? `<p class="secret">${escapeHtml(passphrase)}</p>`
          : `<p class="lede" style="margin:8px 0 0">Write your passphrase here (1Password-style — better on paper than in Downloads):</p><div class="blank"></div>`
      }
    </section>
    <section class="box">
      <p class="label">Recovery key</p>
      ${
        recovery
          ? `<p class="secret">${escapeHtml(recovery)}</p>`
          : `<p class="lede" style="margin:8px 0 0">Shown once when you first enable encryption. Paste or write it here.</p><div class="blank"></div>`
      }
    </section>
    <p class="warn">
      <strong>Keep this off the same cloud as your notes.</strong>
      Print it. Put it with a passport or in a safe. Then delete the downloaded file.
    </p>
    <ul class="warn">
      <li>Passphrase unlocks encryption on every new device.</li>
      <li>Recovery key is the backup if you forget the passphrase. Dripnex cannot reset either.</li>
    </ul>
  </article>
</body>
</html>`;
}

function triggerDownload(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Dripnex Emergency Kit.html';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerPrint(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    triggerDownload(html);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const run = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => iframe.remove(), 1500);
  };
  if (iframe.contentWindow?.document.readyState === 'complete') run();
  else iframe.addEventListener('load', run, { once: true });
}

/** Download a one-page kit (open it and Print → Save as PDF, like 1Password). */
export function downloadEmergencyKit(fields: EmergencyKitFields): void {
  triggerDownload(renderEmergencyKitHtml(fields));
}

/** Native print dialog — on macOS choose “Save as PDF”. */
export function printEmergencyKit(fields: EmergencyKitFields): void {
  triggerPrint(renderEmergencyKitHtml(fields));
}
