import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MoreHorizontal,
  SquareArrowOutUpRight,
  ArrowRightLeft,
  Flag,
  EyeOff,
  Trash2,
  Check,
} from 'lucide-react';
import { BOARD_STAGES } from '@dripnex/core';
import type { BoardStage, NotePriority } from '../../../preload/index';
import { BOARD_STAGE_LABELS, PRIORITY_ORDER, PRIORITY_CONFIG } from './constants';

interface PlanningCardMenuProps {
  readonly currentStage: BoardStage;
  readonly currentPriority: NotePriority;
  readonly onOpen: () => void;
  readonly onMoveStage: (stage: BoardStage) => void;
  readonly onSetPriority: (priority: NotePriority) => void;
  readonly onRemoveFromBoard: () => void;
  readonly onDelete: () => void;
}

/** The "…" actions menu on a Planning card. */
export function PlanningCardMenu({
  currentStage,
  currentPriority,
  onOpen,
  onMoveStage,
  onSetPriority,
  onRemoveFromBoard,
  onDelete,
}: PlanningCardMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowMove(false);
        setShowPriority(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setShowMove(false);
    setShowPriority(false);
  }, []);

  // Stop clicks from bubbling to the card (which would open the note or start a drag).
  const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    <div className="planning-card__menu" ref={containerRef} onClick={stop}>
      <button
        type="button"
        className="planning-card__menu-trigger"
        onClick={() => setIsOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Card actions"
      >
        <MoreHorizontal size={14} />
      </button>

      {isOpen && (
        <div className="planning-card__menu-list" role="menu">
          <button
            type="button"
            role="menuitem"
            className="planning-card__menu-item"
            onClick={() => {
              onOpen();
              close();
            }}
          >
            <SquareArrowOutUpRight size={13} /> Open
          </button>

          <button
            type="button"
            role="menuitem"
            className="planning-card__menu-item"
            aria-expanded={showMove}
            onClick={() => setShowMove(s => !s)}
          >
            <ArrowRightLeft size={13} /> Move to…
          </button>
          {showMove && (
            <div className="planning-card__submenu" role="menu">
              {BOARD_STAGES.map(stage => (
                <button
                  key={stage}
                  type="button"
                  role="menuitem"
                  className={`planning-card__menu-item ${stage === currentStage ? 'is-current' : ''}`}
                  onClick={() => {
                    if (stage !== currentStage) onMoveStage(stage);
                    close();
                  }}
                >
                  <span>{BOARD_STAGE_LABELS[stage]}</span>
                  {stage === currentStage && <Check size={12} />}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            role="menuitem"
            className="planning-card__menu-item"
            aria-expanded={showPriority}
            onClick={() => setShowPriority(s => !s)}
          >
            <Flag size={13} /> Priority…
          </button>
          {showPriority && (
            <div className="planning-card__submenu" role="menu">
              {PRIORITY_ORDER.map(priority => (
                <button
                  key={priority}
                  type="button"
                  role="menuitem"
                  className={`planning-card__menu-item ${priority === currentPriority ? 'is-current' : ''}`}
                  onClick={() => {
                    if (priority !== currentPriority) onSetPriority(priority);
                    close();
                  }}
                >
                  <span className="planning-card__menu-swatch-wrap">
                    <span
                      className="planning-card__menu-swatch"
                      style={{ backgroundColor: PRIORITY_CONFIG[priority].color }}
                      aria-hidden="true"
                    />
                    {PRIORITY_CONFIG[priority].label}
                  </span>
                  {priority === currentPriority && <Check size={12} />}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            role="menuitem"
            className="planning-card__menu-item"
            onClick={() => {
              onRemoveFromBoard();
              close();
            }}
          >
            <EyeOff size={13} /> Remove from board
          </button>

          <button
            type="button"
            role="menuitem"
            className="planning-card__menu-item planning-card__menu-item--danger"
            onClick={() => {
              onDelete();
              close();
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
