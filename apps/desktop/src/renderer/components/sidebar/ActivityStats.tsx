import { useMemo } from 'react';
import { useActivityStats } from '../../hooks/useNotes';
import styles from './ActivityStats.module.css';

/** Number of weeks to display in the heatmap */
const WEEKS_TO_SHOW = 26;

/** Map an activity count to a 0-4 level for color intensity */
function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/** Get ISO week string (YYYY-Www) for a date */
function getISOWeek(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function ActivityStats() {
  const { data, isLoading } = useActivityStats();

  // Build the last WEEKS_TO_SHOW weeks as an ordered array
  const weekCells = useMemo(() => {
    if (!data) return [];

    const weekMap = new Map(data.weeks.map(w => [w.week, w.created + w.updated]));
    const cells: Array<{ week: string; count: number }> = [];
    const now = new Date();

    for (let i = WEEKS_TO_SHOW - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekKey = getISOWeek(d);
      cells.push({ week: weekKey, count: weekMap.get(weekKey) ?? 0 });
    }

    return cells;
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.stats}>
          <span className={styles.stat}>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Heatmap grid - single row of week cells */}
      <div className={styles.heatmap}>
        {weekCells.map(cell => (
          <div
            key={cell.week}
            className={styles.cell}
            data-level={getLevel(cell.count)}
            title={`${cell.week}: ${cell.count} activities`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendLabel}>Less</span>
        {[0, 1, 2, 3, 4].map(level => (
          <div key={level} className={`${styles.cell} ${styles.legendCell}`} data-level={level} />
        ))}
        <span className={styles.legendLabel}>More</span>
      </div>

      {/* Summary stats */}
      <div className={styles.stats}>
        <span className={styles.stat}>
          <span className={styles.statValue}>{data.totalNotes}</span> notes
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>{data.currentStreak}</span> week streak
        </span>
      </div>
    </div>
  );
}
