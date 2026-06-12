// Umbrales de gestos táctiles compartidos (US-108)

/** Mantener pulsado para activar el modo selección. */
export const LONG_PRESS_MS = 500;
/** Máximo entre dos taps para contar como double-tap. */
export const DOUBLE_TAP_MS = 300;
/** Desplazamiento horizontal mínimo para que un gesto cuente como swipe. */
export const SWIPE_THRESHOLD_PX = 50;
/** Velocidad (px/ms) que convierte en swipe un desplazamiento corto pero rápido. */
export const SWIPE_VELOCITY_PX_MS = 0.3;
/** Movimiento máximo para que un toque siga contando como tap. */
export const TAP_SLOP_PX = 15;
/** Duración máxima de un tap. */
export const TAP_MAX_MS = 400;
