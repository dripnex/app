/**
 * AuthGate stacking. LoginBackdrop is a full-window canvas.
 * On Linux Electron an opaque canvas compositor layer can cover later
 * siblings unless the screen isolates and the form sits at a higher z-index.
 */
export const LOGIN_BACKDROP_Z_INDEX = 0;
export const AUTH_GATE_FORM_Z_INDEX = 1;

export function formStacksAboveBackdrop(
  formZ: number = AUTH_GATE_FORM_Z_INDEX,
  backdropZ: number = LOGIN_BACKDROP_Z_INDEX
): boolean {
  return formZ > backdropZ;
}
