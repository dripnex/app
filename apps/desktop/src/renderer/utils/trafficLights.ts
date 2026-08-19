/** macOS traffic lights sit over the first column header. */
export function needsTrafficLightInset(platform = navigator.platform): boolean {
  return /mac/i.test(platform);
}
