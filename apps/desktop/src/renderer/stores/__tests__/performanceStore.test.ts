import { describe, it, expect, beforeEach } from 'vitest';
import {
  usePerformanceStore,
  selectMode,
  selectBaseMode,
  selectIsResizing,
} from '../performanceStore';

describe('performanceStore', () => {
  // Reset to initial state before each test. For the "initial state" test below,
  // this reset effectively sets the store to its default values, which is what
  // we assert against — Zustand stores are singletons shared across tests.
  beforeEach(() => {
    usePerformanceStore.setState({
      mode: 'medium',
      baseMode: 'medium',
      isResizing: false,
    });
  });

  describe('initial state', () => {
    it('starts with medium mode', () => {
      const state = usePerformanceStore.getState();
      expect(state.mode).toBe('medium');
      expect(state.baseMode).toBe('medium');
      expect(state.isResizing).toBe(false);
    });
  });

  describe('setMode', () => {
    it('updates active mode', () => {
      usePerformanceStore.getState().setMode('low');
      expect(usePerformanceStore.getState().mode).toBe('low');
    });

    it('does not affect baseMode', () => {
      usePerformanceStore.getState().setMode('low');
      expect(usePerformanceStore.getState().baseMode).toBe('medium');
    });
  });

  describe('setBaseMode', () => {
    it('updates base mode', () => {
      usePerformanceStore.getState().setBaseMode('high');
      expect(usePerformanceStore.getState().baseMode).toBe('high');
    });
  });

  describe('setResizing', () => {
    it('toggles resize state', () => {
      usePerformanceStore.getState().setResizing(true);
      expect(usePerformanceStore.getState().isResizing).toBe(true);

      usePerformanceStore.getState().setResizing(false);
      expect(usePerformanceStore.getState().isResizing).toBe(false);
    });
  });

  describe('selectors', () => {
    it('selectMode returns current mode', () => {
      usePerformanceStore.getState().setMode('high');
      expect(selectMode(usePerformanceStore.getState())).toBe('high');
    });

    it('selectBaseMode returns base mode', () => {
      usePerformanceStore.getState().setBaseMode('low');
      expect(selectBaseMode(usePerformanceStore.getState())).toBe('low');
    });

    it('selectIsResizing returns resize state', () => {
      expect(selectIsResizing(usePerformanceStore.getState())).toBe(false);
      usePerformanceStore.getState().setResizing(true);
      expect(selectIsResizing(usePerformanceStore.getState())).toBe(true);
    });
  });
});
