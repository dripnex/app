/** Play the 8px enter only when the AI panel goes from closed to open. */
export function shouldPlayPanelIn(wasOpen: boolean, open: boolean): boolean {
  return !wasOpen && open;
}
