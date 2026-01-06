/**
 * Graph View Component
 *
 * Visualizes notes as nodes and their wikilinks as edges
 * using react-force-graph-2d for interactive exploration.
 */

import { useCallback, useRef, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { X } from 'lucide-react';
import { useGraphData } from '../hooks/useLinks';
import './GraphView.css';

interface GraphViewProps {
  /** Currently selected note ID (will be highlighted) */
  selectedNoteId?: string | null;
  /** Callback when a node is clicked */
  onNodeClick?: (noteId: string) => void;
  /** Callback to close the graph view */
  onClose?: () => void;
}

interface GraphNode {
  id: string;
  title: string;
  notebookId: string;
  // Force graph internal properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

export function GraphView({ selectedNoteId, onNodeClick, onClose }: GraphViewProps) {
  const { data, isLoading, error } = useGraphData();
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink>>();

  // Transform data for react-force-graph
  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };

    return {
      nodes: data.nodes.map(n => ({
        id: n.id,
        title: n.title,
        notebookId: n.notebookId,
      })),
      links: data.edges.map(e => ({
        source: e.source,
        target: e.target,
      })),
    };
  }, [data]);

  // Node color based on selection (using hex - CSS vars don't work in canvas)
  const getNodeColor = useCallback(
    (node: GraphNode) => {
      if (node.id === selectedNoteId) {
        return '#6366f1'; // accent/indigo
      }
      return '#a1a1aa'; // zinc-400
    },
    [selectedNoteId]
  );

  // Node size based on connections (nodeVal is area, not radius)
  const getNodeSize = useCallback(
    (node: GraphNode) => {
      const linkCount = graphData.links.filter(l => {
        const sourceId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const targetId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        return sourceId === node.id || targetId === node.id;
      }).length;
      // Small values: 1 = tiny, 3 = medium, 5 = large
      return Math.max(1, Math.min(4, 1 + linkCount * 0.5));
    },
    [graphData.links]
  );

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  // Draw node label (using hex - CSS vars don't work in canvas)
  const drawNodeLabel = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.title || 'Untitled';
      const fontSize = 11 / globalScale;

      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = node.id === selectedNoteId ? '#818cf8' : '#d4d4d8'; // indigo-400 : zinc-300
      ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + 6);
    },
    [selectedNoteId]
  );

  if (isLoading) {
    return (
      <div className="graph-view">
        <div className="graph-view__loading">Loading graph...</div>
      </div>
    );
  }

  if (error) {
    console.error('Graph data error:', error);
    return (
      <div className="graph-view">
        <div className="graph-view__header">
          <h2>Graph View</h2>
          {onClose && (
            <button className="graph-view__close" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="graph-view__error">
          Failed to load graph data
          <p className="graph-view__hint">Check console for details</p>
        </div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="graph-view">
        <div className="graph-view__header">
          <h2>Graph View</h2>
          {onClose && (
            <button className="graph-view__close" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="graph-view__empty">
          <p>No notes to display</p>
          <p className="graph-view__hint">
            Create some notes and link them with [[wikilinks]]
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-view">
      <div className="graph-view__header">
        <h2>Graph View</h2>
        <span className="graph-view__stats">
          {graphData.nodes.length} notes, {graphData.links.length} links
        </span>
        {onClose && (
          <button className="graph-view__close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        )}
      </div>
      <div className="graph-view__container">
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeId="id"
          nodeLabel="title"
          nodeColor={getNodeColor}
          nodeVal={getNodeSize}
          linkColor={() => '#52525b'}
          linkWidth={1.5}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          onNodeClick={handleNodeClick}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={drawNodeLabel}
          backgroundColor="#18181b"
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      </div>
    </div>
  );
}
