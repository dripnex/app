import { describe, expect, it } from 'vitest';
import { needsTrafficLightInset } from '../trafficLights';

describe('needsTrafficLightInset', () => {
  it('is true on macOS', () => {
    expect(needsTrafficLightInset('MacIntel')).toBe(true);
  });

  it('is false on Windows and Linux', () => {
    expect(needsTrafficLightInset('Win32')).toBe(false);
    expect(needsTrafficLightInset('Linux x86_64')).toBe(false);
  });
});
