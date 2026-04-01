import type { IndoorOverlayColors } from './IndoorOverlayColors';

export function getIndoorOverlayColors(isColorBlind: boolean): IndoorOverlayColors {
  return {
    outlineFill: 'rgba(230, 230, 230, 0.65)',
    outlineStroke: 'rgba(180, 180, 180, 0.8)',
    areaFill: isColorBlind ? 'rgba(235, 225, 215, 0.5)' : 'rgba(215, 225, 235, 0.5)',
    roomFill: isColorBlind ? 'rgba(235, 210, 200, 0.6)' : 'rgba(200, 210, 225, 0.6)',
    roomStroke: isColorBlind ? 'rgba(170, 140, 120, 0.8)' : 'rgba(120, 140, 170, 0.8)',
    roomSelectedFill: isColorBlind ? 'rgba(178, 27, 44, 0.35)' : 'rgba(26, 115, 232, 0.35)',
    roomSelectedStroke: isColorBlind ? 'rgba(178, 27, 44, 0.9)' : 'rgba(26, 115, 232, 0.9)',
    stairs: 'rgba(180, 120, 40, 0.75)',
    escalator: 'rgba(140, 100, 180, 0.75)',
    escalatorFill: 'rgba(140, 100, 180, 0.2)',
    escalatorFillMuted: 'rgba(140, 100, 180, 0.05)',
    escalatorStrokeMuted: 'rgba(140, 100, 180, 0.2)',
  };
}
