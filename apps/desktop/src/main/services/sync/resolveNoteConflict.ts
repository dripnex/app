export interface ConflictVersions {
  localContent: string;
  remoteContent: string;
}

/** Content that should live on the original note after the user picks a side. */
export function chosenConflictContent(
  resolution: 'local' | 'remote',
  versions: ConflictVersions
): string {
  return resolution === 'local' ? versions.localContent : versions.remoteContent;
}

/**
 * Pull already writes the remote body onto the note. Keep-local must restore
 * the captured local body before we mark the note dirty for push.
 */
export function needsLocalRestore(currentContent: string, localContent: string): boolean {
  return currentContent !== localContent;
}
