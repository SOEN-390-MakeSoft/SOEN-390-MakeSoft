import { StyleSheet } from 'react-native';

export const navigationSharedStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 14,
    paddingBottom: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 40,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  positionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  instructionTitle: {
    marginTop: 10,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  instructionRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  instructionIconWrap: {
    width: 26,
    alignItems: 'center',
    paddingTop: 1,
    marginRight: 6,
  },
  instructionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
    flex: 1,
  },
  metaText: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
  },
  doneButton: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
