/** Play the 8px enter only when the pane goes from hidden to visible. */
export function shouldPlaySidebarIn(wasHidden: boolean, hidden: boolean): boolean {
  return wasHidden && !hidden;
}
