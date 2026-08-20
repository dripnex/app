/**
 * Knowledge graph — notes as typed nodes, wikilinks + inferred edges.
 * Click inspects. Double-click / Open jumps to the note.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ForceGraph2D from 'react-force-graph-2d';
import { X } from 'lucide';
import { Icon } from '../ui/icons/Icon';
import { useGraphData } from '../hooks/useLinks';
import { noteKeys } from '../hooks/useNotes';
import { Input } from '../ui/primitives';
import {
  NOTE_KINDS,
  kindFromTags,
  kindMeta,
  pairKey,
  tagsWithKind,
  type EdgeKind,
  type NoteKind,
} from '../lib/knowledge';
import { GraphInspector, type GraphActivityEvent, type GraphRelation } from './GraphInspector';
import styles from './GraphView.module.css';

interface GraphViewProps {
  selectedNoteId?: string | null;
  onOpenNote?: (noteId: string) => void;
  onAskNote?: (noteId: string) => void;
  onClose?: () => void;
}

interface GraphNode {
  id: string;
  title: string;
  notebookId: string;
  kind: NoteKind;
  tags: string[];
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  kind: EdgeKind;
  score?: number;
}

function linkEndId(end: string | GraphNode): string {
  return typeof end === 'string' ? end : end.id;
}

function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function GraphView({ selectedNoteId, onOpenNote, onAskNote, onClose }: GraphViewProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useGraphData();
  const inferred = useQuery({
    queryKey: ['kb', 'inferred-graph'],
    queryFn: async () => {
      const api = window.dripnex?.ai;
      if (!api || typeof api.inferredGraph !== 'function') return [];
      try {
        return await api.inferredGraph();
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [focusedId, setFocusedId] = useState<string | null>(selectedNoteId ?? null);
  const [query, setQuery] = useState('');
  const lastClickRef = useRef<{ id: string; at: number } | null>(null);
  const didFitRef = useRef(false);
  const [canvasHost, setCanvasHost] = useState<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [activity, setActivity] = useState<GraphActivityEvent[]>([]);
  const [activityState, setActivityState] = useState<'idle' | 'running'>('idle');

  useEffect(() => {
    if (selectedNoteId) setFocusedId(selectedNoteId);
  }, [selectedNoteId]);

  useEffect(() => {
    if (!canvasHost) return;
    const apply = (width: number, height: number) => {
      const next = { width: Math.floor(width), height: Math.floor(height) };
      if (next.width <= 0 || next.height <= 0) return;
      setCanvasSize(prev =>
        prev.width === next.width && prev.height === next.height ? prev : next
      );
    };
    apply(canvasHost.clientWidth, canvasHost.clientHeight);
    const observer = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect;
      if (box) apply(box.width, box.height);
    });
    observer.observe(canvasHost);
    return () => observer.disconnect();
  }, [canvasHost]);

  useEffect(() => {
    didFitRef.current = false;
  }, [canvasSize.width, canvasSize.height]);

  const graphData = useMemo((): { nodes: GraphNode[]; links: GraphLink[] } => {
    if (!data) return { nodes: [], links: [] };
    const nodes: GraphNode[] = data.nodes.map(node => ({
      id: node.id,
      title: node.title,
      notebookId: node.notebookId,
      tags: node.tags ?? [],
      kind: kindFromTags(
        node.tags,
        node.status as 'active' | 'on_hold' | 'completed' | 'dropped' | undefined
      ),
    }));
    const known = new Set(nodes.map(node => node.id));
    const wikiPairs = new Set<string>();
    const links: GraphLink[] = data.edges.map(edge => {
      wikiPairs.add(pairKey(edge.source, edge.target));
      return { source: edge.source, target: edge.target, kind: 'relates-to' as const };
    });
    for (const edge of inferred.data ?? []) {
      if (!known.has(edge.source) || !known.has(edge.target)) continue;
      if (wikiPairs.has(pairKey(edge.source, edge.target))) continue;
      links.push({
        source: edge.source,
        target: edge.target,
        kind: 'inferred',
        score: edge.score,
      });
    }
    return { nodes, links };
  }, [data, inferred.data]);

  const nodeById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of graphData.nodes) map.set(node.id, node);
    return map;
  }, [graphData.nodes]);

  const inferredCount = useMemo(
    () => graphData.links.filter(link => link.kind === 'inferred').length,
    [graphData.links]
  );
  const wikiCount = graphData.links.length - inferredCount;

  const neighborIds = useMemo(() => {
    const set = new Set<string>();
    if (!focusedId) return set;
    set.add(focusedId);
    for (const link of graphData.links) {
      const source = linkEndId(link.source);
      const target = linkEndId(link.target);
      if (source === focusedId) set.add(target);
      if (target === focusedId) set.add(source);
    }
    return set;
  }, [focusedId, graphData.links]);

  const matchIds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    return new Set(
      graphData.nodes
        .filter(node => (node.title || 'untitled').toLowerCase().includes(needle))
        .map(node => node.id)
    );
  }, [graphData.nodes, query]);

  const relations = useMemo((): GraphRelation[] => {
    if (!focusedId) return [];
    const out: GraphRelation[] = [];
    for (const link of graphData.links) {
      const source = linkEndId(link.source);
      const target = linkEndId(link.target);
      if (source === focusedId) {
        const node = nodeById.get(target);
        if (!node) continue;
        out.push({
          id: target,
          title: node.title || 'Untitled',
          direction: 'to',
          kind: link.kind,
          score: link.score,
          nodeKind: node.kind,
        });
      } else if (target === focusedId) {
        const node = nodeById.get(source);
        if (!node) continue;
        out.push({
          id: source,
          title: node.title || 'Untitled',
          direction: 'from',
          kind: link.kind,
          score: link.score,
          nodeKind: node.kind,
        });
      }
    }
    return out.sort((a, b) => Number(a.kind === 'inferred') - Number(b.kind === 'inferred'));
  }, [focusedId, graphData.links, nodeById]);

  const focusNode = useCallback(
    (id: string, pan = true) => {
      setFocusedId(id);
      if (!pan || !graphRef.current) return;
      const node = graphData.nodes.find(item => item.id === id);
      if (node && typeof node.x === 'number' && typeof node.y === 'number') {
        graphRef.current.centerAt(node.x, node.y, 350);
      }
    },
    [graphData.nodes]
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      const now = Date.now();
      const previous = lastClickRef.current;
      if (previous && previous.id === node.id && now - previous.at < 320) {
        lastClickRef.current = null;
        onOpenNote?.(node.id);
        return;
      }
      lastClickRef.current = { id: node.id, at: now };
      focusNode(node.id, true);
    },
    [focusNode, onOpenNote]
  );

  const drawNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const selected = node.id === focusedId;
      const related = !focusedId || neighborIds.has(node.id);
      const matched = !matchIds || matchIds.has(node.id);
      const dimmed = !related || !matched;
      const color = kindMeta(node.kind).color;
      const radius = selected ? 5.5 : 4;

      ctx.save();
      ctx.globalAlpha = dimmed ? 0.2 : 1;

      if (selected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = `${color}40`;
        ctx.fill();
        ctx.lineWidth = 1.4 / Math.max(globalScale, 0.6);
        ctx.strokeStyle = color;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      const label = node.title || 'Untitled';
      const fontSize = Math.max(10, 11 / Math.max(globalScale, 0.8));
      ctx.font = `${selected ? 600 : 400} ${fontSize}px ${token('--font-sans', 'sans-serif')}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = selected
        ? token('--text-primary', '#f4f4f5')
        : token('--text-secondary', 'rgba(255,255,255,0.7)');
      ctx.fillText(label, x + radius + 7, y);
      ctx.restore();
    },
    [focusedId, matchIds, neighborIds]
  );

  const paintPointer = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, 11, 0, Math.PI * 2);
      ctx.fill();
    },
    []
  );

  const drawLink = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const source = typeof link.source === 'object' ? link.source : null;
      const target = typeof link.target === 'object' ? link.target : null;
      if (!source || !target || source.x == null || target.x == null) return;

      const hot = Boolean(focusedId) && (source.id === focusedId || target.id === focusedId);
      const muted = Boolean(focusedId) && !hot;
      const inferredEdge = link.kind === 'inferred';

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(source.x, source.y ?? 0);
      ctx.lineTo(target.x, target.y ?? 0);
      if (inferredEdge) ctx.setLineDash([4 / globalScale, 4 / globalScale]);
      ctx.strokeStyle = hot
        ? inferredEdge
          ? token('--accent', '#5eead4')
          : token('--text-muted', 'rgba(255,255,255,0.5)')
        : token('--border-strong', 'rgba(255,255,255,0.12)');
      ctx.globalAlpha = muted ? 0.12 : hot ? 0.85 : inferredEdge ? 0.35 : 0.4;
      ctx.lineWidth = (hot ? 1.2 : 0.7) / Math.max(globalScale, 0.7);
      ctx.stroke();

      if (hot && globalScale > 1.05) {
        const mx = ((source.x ?? 0) + (target.x ?? 0)) / 2;
        const my = ((source.y ?? 0) + (target.y ?? 0)) / 2;
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.8;
        ctx.font = `500 ${9 / globalScale}px ${token('--font-sans', 'sans-serif')}`;
        ctx.fillStyle = inferredEdge
          ? token('--accent', '#5eead4')
          : token('--text-muted', 'rgba(255,255,255,0.5)');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(inferredEdge ? 'inferred' : 'relates-to', mx, my - 2 / globalScale);
      }
      ctx.restore();
    },
    [focusedId]
  );

  const handleEngineStop = useCallback(() => {
    if (didFitRef.current) return;
    didFitRef.current = true;
    graphRef.current?.zoomToFit?.(400, 64);
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.d3Force?.('charge')?.strength(-110);
    graph.d3Force?.('link')?.distance(80);
  }, [graphData.nodes.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (focusedId) {
        setFocusedId(null);
        return;
      }
      onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedId, onClose]);

  const handleKindChange = useCallback(
    async (noteId: string, kind: NoteKind) => {
      const api = window.dripnex?.notes;
      if (!api) return;
      const manual = await api.getManualTags(noteId);
      await api.setManualTags(noteId, tagsWithKind(manual, kind));
      void queryClient.invalidateQueries({ queryKey: noteKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['links'] });
    },
    [queryClient]
  );

  const handleAsk = useCallback(
    async (noteId: string) => {
      const node = nodeById.get(noteId);
      const api = window.dripnex?.ai;
      setActivityState('running');
      setActivity([
        { id: 'retrieve', title: 'retrieve.notes', detail: 'Searching the local index…' },
      ]);
      try {
        const hits =
          api && typeof api.retrieve === 'function'
            ? await api.retrieve({
                query: node?.title || 'related notes',
                topK: 5,
                excludeIds: [noteId],
              })
            : [];
        const inferredHits = (inferred.data ?? []).filter(
          edge => edge.source === noteId || edge.target === noteId
        );
        setActivity([
          {
            id: 'retrieve',
            title: 'retrieve.notes',
            detail:
              hits.length > 0
                ? `Found ${hits.length} candidate notes${hits
                    .slice(0, 3)
                    .map(hit => `\n${hit.title}`)
                    .join('')}`
                : 'No embedded passages yet. Index notes in Settings → AI.',
          },
          {
            id: 'infer',
            title: 'graph.infer_relations',
            detail:
              inferredHits.length > 0
                ? `Inferred ${inferredHits.length} dashed relations from embeddings`
                : 'No inferred edges above the similarity threshold',
          },
        ]);
      } catch {
        setActivity([
          {
            id: 'retrieve',
            title: 'retrieve.notes',
            detail: 'Retrieve failed. Check the embed provider in Settings → AI.',
          },
        ]);
      } finally {
        setActivityState('idle');
      }
      onAskNote?.(noteId);
    },
    [inferred.data, nodeById, onAskNote]
  );

  const stage = (child: ReactNode) => (
    <div className={styles.graph}>
      <div className={styles.stage}>{child}</div>
      <GraphInspector
        noteId={null}
        relations={[]}
        activity={activity}
        activityState={activityState}
        onOpen={() => undefined}
        onFocus={() => undefined}
        onAsk={() => undefined}
        onKindChange={() => undefined}
        onDismiss={() => undefined}
      />
    </div>
  );

  if (isLoading) {
    return stage(<div className={styles.center}>Loading graph…</div>);
  }

  if (error) {
    return stage(
      <div className={`${styles.center} ${styles.centerError}`}>
        Failed to load graph
        <p className={styles.centerHint}>Wikilinks will appear here once notes are indexed.</p>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return stage(
      <div className={styles.center}>
        No notes to map
        <p className={styles.centerHint}>Create notes and connect them with [[wikilinks]].</p>
      </div>
    );
  }

  return (
    <div className={styles.graph}>
      <div className={styles.stage}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{graphData.nodes.length}</span>
            <span className={styles.statLabel}>Notes</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{wikiCount}</span>
            <span className={styles.statLabel}>Links</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{inferredCount}</span>
            <span className={styles.statLabel}>Inferred</span>
          </div>
        </div>

        <div className={styles.tools}>
          <div className={styles.search}>
            <Input
              size="sm"
              type="search"
              value={query}
              placeholder="Filter"
              onChange={event => setQuery(event.target.value)}
              aria-label="Filter notes in graph"
            />
          </div>
          {onClose ? (
            <button type="button" className={styles.iconBtn} onClick={onClose} title="Close graph">
              <Icon icon={X} size={14} />
            </button>
          ) : null}
        </div>

        <div ref={setCanvasHost} className={styles.canvasHost}>
          {canvasSize.width > 0 && canvasSize.height > 0 ? (
            <ForceGraph2D
              ref={graphRef}
              width={canvasSize.width}
              height={canvasSize.height}
              graphData={graphData}
              nodeId="id"
              nodeRelSize={4}
              nodeCanvasObjectMode={() => 'replace'}
              nodeCanvasObject={drawNode}
              nodePointerAreaPaint={paintPointer}
              linkCanvasObjectMode={() => 'replace'}
              linkCanvasObject={drawLink}
              backgroundColor="rgba(0,0,0,0)"
              cooldownTicks={110}
              d3AlphaDecay={0.025}
              d3VelocityDecay={0.32}
              onNodeClick={handleNodeClick}
              onBackgroundClick={() => setFocusedId(null)}
              onEngineStop={handleEngineStop}
              enableNodeDrag
            />
          ) : null}
        </div>

        <div className={styles.legend}>
          {NOTE_KINDS.map(item => (
            <span key={item.id} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
          <span className={styles.legendItem}>
            <span className={styles.dash} />
            inferred
          </span>
        </div>
      </div>

      <GraphInspector
        noteId={focusedId}
        relations={relations}
        activity={activity}
        activityState={activityState}
        onOpen={id => onOpenNote?.(id)}
        onFocus={id => focusNode(id, true)}
        onAsk={id => void handleAsk(id)}
        onKindChange={(id, kind) => void handleKindChange(id, kind)}
        onDismiss={() => setFocusedId(null)}
      />
    </div>
  );
}
