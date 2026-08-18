import { useCallback, useEffect, useState } from 'react';
import githubLogo from '@lobehub/icons-static-svg/icons/github.svg';
import { Button, Field, Input } from '../../../ui/primitives';
import { getGitHubApi } from '../../../integrations/host';
import type { GitHubWatcher } from '../../../../preload/api/integrations';
import styles from './IntegrationsSection.module.css';

export function GitHubCard() {
  const api = getGitHubApi();
  const [login, setLogin] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [issueUrl, setIssueUrl] = useState('');
  const [watchSpec, setWatchSpec] = useState('');
  const [watchers, setWatchers] = useState<GitHubWatcher[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshWatchers = useCallback(async () => {
    if (!api?.listWatchers) return;
    setWatchers(await api.listWatchers());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    void api.status().then(status => {
      setLogin(status.connected ? status.login : null);
    });
    void refreshWatchers();
  }, [api, refreshWatchers]);

  const connect = async () => {
    if (!api || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await api.connect(token.trim() || null);
    setBusy(false);
    if (result.success) {
      setLogin(result.login);
      setToken('');
      setMessage(`Connected as @${result.login}`);
      return;
    }
    setError(result.error);
  };

  const disconnect = async () => {
    if (!api) return;
    await api.disconnect();
    setLogin(null);
    setMessage(null);
  };

  const importIssue = async () => {
    if (!api || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const fetched = await api.importIssue(issueUrl);
    if (!fetched.success) {
      setBusy(false);
      setError(fetched.error);
      return;
    }
    const created = await window.dripnex.notes.create({
      content: fetched.content,
      notebookId: 'inbox',
    });
    setBusy(false);
    if (!created.ok) {
      setError('Connected, but could not create the note.');
      return;
    }
    setIssueUrl('');
    setMessage(`Imported “${fetched.title}” into Inbox.`);
  };

  const addWatcher = async () => {
    if (!api || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const added = await api.addWatcher(watchSpec);
    setBusy(false);
    if (!added.success) {
      setError(added.error);
      return;
    }
    setWatchSpec('');
    await refreshWatchers();
    setMessage(`Watching ${added.watcher.label}.`);
  };

  const pullWatchers = async (watcherId?: string) => {
    if (!api || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const pulled = await api.pullWatchers(watcherId);
    setBusy(false);
    if (!pulled.success) {
      setError(pulled.error);
      return;
    }
    await refreshWatchers();
    const bits = [`${pulled.created} new`, `${pulled.updated} updated`];
    if (pulled.skipped) bits.push(`${pulled.skipped} unchanged`);
    setMessage(`Pulled ${bits.join(', ')}.`);
    if (pulled.errors.length > 0) setError(pulled.errors.join(' · '));
  };

  const removeWatcher = async (id: string) => {
    if (!api) return;
    await api.removeWatcher(id);
    await refreshWatchers();
  };

  const connected = Boolean(login);

  return (
    <article className={styles.card} data-tone={connected ? 'ok' : 'idle'}>
      <div className={styles.cardTop}>
        <span className={styles.brandMark} aria-hidden="true">
          <img src={githubLogo} alt="" />
        </span>
        <div className={styles.cardCopy}>
          <div className={styles.cardNameRow}>
            <h3 className={styles.cardName}>GitHub</h3>
            <span className={styles.badge} data-tone={connected ? 'ok' : 'idle'}>
              {connected ? `@${login}` : 'Not connected'}
            </span>
          </div>
          <p className={styles.cardDesc}>
            Connect, import one issue, or watch a repo. Pull writes notes to Inbox and
            refreshes them from GitHub.
          </p>
        </div>
      </div>

      {!api ? (
        <p className={styles.callout} data-tone="warn">
          Restart Dripnex to load the GitHub bridge.
        </p>
      ) : connected ? (
        <div className={styles.body}>
          <Field label="Import issue" htmlFor="gh-issue">
            <Input
              id="gh-issue"
              value={issueUrl}
              onChange={event => setIssueUrl(event.target.value)}
              placeholder="https://github.com/org/repo/issues/12"
            />
          </Field>
          <div className={styles.actions}>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={!issueUrl.trim()}
              onClick={() => void importIssue()}
            >
              Import to Inbox
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void disconnect()}>
              Disconnect
            </Button>
          </div>
          <Field label="Watch" htmlFor="gh-watch">
            <Input
              id="gh-watch"
              value={watchSpec}
              onChange={event => setWatchSpec(event.target.value)}
              placeholder="owner/repo or repo:org/name is:open"
            />
          </Field>
          <div className={styles.actions}>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={!watchSpec.trim()}
              onClick={() => void addWatcher()}
            >
              Watch
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={busy}
              disabled={watchers.length === 0}
              onClick={() => void pullWatchers()}
            >
              Pull all
            </Button>
          </div>
          {watchers.length > 0 ? (
            <ul className={styles.watchList}>
              {watchers.map(watcher => (
                <li key={watcher.id} className={styles.watchRow}>
                  <div className={styles.watchCopy}>
                    <span className={styles.watchLabel}>{watcher.label}</span>
                    <span className={styles.watchMeta}>
                      {watcher.lastError
                        ? watcher.lastError
                        : watcher.lastPulledAt
                          ? `Pulled ${watcher.lastPulledAt.slice(0, 16).replace('T', ' ')}`
                          : 'Not pulled yet'}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busy}
                      onClick={() => void pullWatchers(watcher.id)}
                    >
                      Pull
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void removeWatcher(watcher.id)}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className={styles.body}>
          <p className={styles.fieldHint}>
            If you already use the GitHub CLI, Connect uses <code>gh auth token</code>. Otherwise paste
            a classic token with <code>repo</code> scope.
          </p>
          <Field label="Token (optional)" htmlFor="gh-token">
            <Input
              id="gh-token"
              type="password"
              mono
              value={token}
              onChange={event => setToken(event.target.value)}
              placeholder="ghp_… or leave empty to use gh"
              autoComplete="off"
            />
          </Field>
          <div className={styles.actions}>
            <Button variant="primary" size="sm" loading={busy} onClick={() => void connect()}>
              Connect GitHub
            </Button>
            <a
              className={styles.docLink}
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noreferrer"
            >
              Create a token
            </a>
          </div>
        </div>
      )}

      {message ? <p className={styles.hintOk}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </article>
  );
}
