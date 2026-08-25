import { describe, expect, it } from 'vitest';
import { appMenuIncludesSettings, fileMenuSlots } from '../menuLayout';

describe('fileMenuSlots', () => {
  it('puts Settings in File on Linux so the workspace is reachable without a session', () => {
    expect(fileMenuSlots('linux')).toEqual(['settings', 'separator', 'quit']);
  });

  it('puts Settings in File on Windows', () => {
    expect(fileMenuSlots('win32')).toEqual(['settings', 'separator', 'quit']);
  });

  it('leaves macOS File as Close; Settings lives in the app menu', () => {
    expect(fileMenuSlots('darwin')).toEqual(['close']);
    expect(appMenuIncludesSettings('darwin')).toBe(true);
    expect(appMenuIncludesSettings('linux')).toBe(false);
  });
});
