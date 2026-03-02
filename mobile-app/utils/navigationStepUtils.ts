import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export const STEP_ICON_MAP: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  'turn-left': 'turn-left',
  'turn-right': 'turn-right',
  'turn-slight-left': 'turn-slight-left',
  'turn-slight-right': 'turn-slight-right',
  'turn-sharp-left': 'turn-left',
  'turn-sharp-right': 'turn-right',
  'uturn-left': 'u-turn-left',
  'uturn-right': 'u-turn-right',
  merge: 'merge',
  'fork-left': 'fork-left',
  'fork-right': 'fork-right',
  'ramp-left': 'turn-slight-left',
  'ramp-right': 'turn-slight-right',
  'roundabout-left': 'roundabout-left',
  'roundabout-right': 'roundabout-right',
  straight: 'straight',
};

export function getStepIcon(maneuver?: string): keyof typeof MaterialIcons.glyphMap {
  if (!maneuver) return 'straight';
  return STEP_ICON_MAP[maneuver] ?? 'straight';
}
