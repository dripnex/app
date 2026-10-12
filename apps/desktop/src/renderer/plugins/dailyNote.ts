import type { PluginManifest, NoteSummaryInfo } from '@dripnex/plugin-api';

export function dailyNoteTitle(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local calendar day before `date`. Avoids UTC drift around midnight. */
export function yesterdayDate(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
}

/** Local calendar day after `date`. Avoids UTC drift around midnight. */
export function tomorrowDate(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

export function dailyNoteBody(title: string): string {
  return `# ${title}\n\n`;
}

export function findNoteByTitle(
  notes: ReadonlyArray<Pick<NoteSummaryInfo, 'id' | 'title'>>,
  title: string
): string | null {
  const found = notes.find(note => note.title === title);
  return found?.id ?? null;
}

export const dailyNotePlugin: PluginManifest = {
  id: 'dripnex-daily-note',
  name: 'Daily Note',
  version: '1.0.0',
  description: 'Open or create today’s, yesterday’s, or tomorrow’s note',

  activate(context) {
    const openOn = async (date: Date) => {
      const title = dailyNoteTitle(date);
      const listed = await context.app.listNotes();
      const existing = findNoteByTitle(listed, title);
      if (existing) {
        await context.dispatchCommand('app:open-note', { noteId: existing });
        return true;
      }
      const created = await context.data.createNote({ content: dailyNoteBody(title) });
      await context.dispatchCommand('app:open-note', { noteId: created.id });
      return true;
    };

    const unregisterToday = context.registerCommand(
      {
        id: 'open',
        name: 'Open Daily Note',
        icon: 'Calendar',
        keybinding: { key: 'd', modifiers: ['Mod', 'Shift'] },
      },
      () => void openOn(new Date())
    );
    const unregisterYesterday = context.registerCommand(
      { id: 'open-yesterday', name: 'Open Yesterday’s Daily Note', icon: 'Calendar' },
      () => void openOn(yesterdayDate())
    );
    const unregisterTomorrow = context.registerCommand(
      { id: 'open-tomorrow', name: 'Open Tomorrow’s Daily Note', icon: 'Calendar' },
      () => void openOn(tomorrowDate())
    );

    return {
      dispose() {
        unregisterToday();
        unregisterYesterday();
        unregisterTomorrow();
      },
    };
  },
};
