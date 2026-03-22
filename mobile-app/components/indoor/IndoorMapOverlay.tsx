/**
 * IndoorMapOverlay – renders a floor plan on a react-native-maps MapView by
 * drawing the GeoJSON features directly as native map Polygons and Polylines.
 *
 * This approach guarantees that rooms, corridors, stairs etc. are always
 * pixel-perfect aligned with markers and route polylines, because everything
 * shares the same geographic coordinate space.  No image bounds or bearing
 * calibration is needed.
 *
 * Rendered layers (back-to-front):
 *   1. Level outline / area polygons (light fill)
 *   2. Room polygons (tappable — selecting a room shows the info bubble)
 *   3. Corridor polylines
 *   4. Stairs / elevator / escalator indicators
 *   5. Indoor route polyline (if a route is active)
 *   6. Destination marker pin
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, Image } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Marker, Polygon, Polyline } from 'react-native-maps';
import type {
  IndoorFeature,
  IndoorRoom,
  IndoorStairs,
  IndoorElevator,
  IndoorEscalator,
  IndoorLevelOutline,
  IndoorArea,
  IndoorPOI,
  IndoorRoute,
} from '../../services/indoor/types';
import type { ResolvedRoom } from '../../services/indoor/roomResolver';

// ---------------------------------------------------------------------------
// Colour palette for indoor features
// ---------------------------------------------------------------------------

const COLORS = {
  outlineFill: 'rgba(230, 230, 230, 0.65)',
  outlineStroke: 'rgba(180, 180, 180, 0.8)',
  areaFill: 'rgba(215, 225, 235, 0.5)',
  roomFill: 'rgba(200, 210, 225, 0.6)',
  roomStroke: 'rgba(120, 140, 170, 0.8)',
  roomSelectedFill: 'rgba(26, 115, 232, 0.35)',
  roomSelectedStroke: 'rgba(26, 115, 232, 0.9)',
  stairs: 'rgba(180, 120, 40, 0.75)',
  escalator: 'rgba(140, 100, 180, 0.75)',
  bathroomFill: 'rgba(100, 150, 255, 0.15)',
  bathroomStroke: 'rgba(100, 150, 255, 0.6)',
  waterFountainFill: 'rgba(100, 200, 255, 0.15)',
  waterFountainStroke: 'rgba(100, 200, 255, 0.6)',
};

// ---------------------------------------------------------------------------
// Helper to map POI image paths to require() calls
// ---------------------------------------------------------------------------

function getPoiImageSource(imagePath?: string) {
  if (!imagePath) return null;

  // Map relative paths to require() calls
  const imageMap: Record<string, any> = {
    'assets/images/women_bathroom.png': require('../../assets/images/women_bathroom.png'),
    'assets/images/men_bathroom.png': require('../../assets/images/men_bathroom.png'),
    'assets/images/unisex_bathroom.png': require('../../assets/images/unisex_bathroom.png'),
    'assets/images/water_fountain.png': require('../../assets/images/water_fountain.png'),
  };

  return imageMap[imagePath] ?? null;
}

// Helper to determine the correct bathroom icon based on gender accessibility
function getBathroomImagePath(
  amenity: string,
  male?: boolean,
  female?: boolean,
): string | undefined {
  if (amenity !== 'toilets') return undefined;

  // Both male and female → unisex
  if (male && female) return 'assets/images/unisex_bathroom.png';
  // Only male
  if (male && !female) return 'assets/images/men_bathroom.png';
  // Only female
  if (female && !male) return 'assets/images/women_bathroom.png';

  return 'assets/images/unisex_bathroom.png';
}

// Helper to determine the correct image path based on amenity type
function getImagePathForAmenity(
  amenity: string,
  male?: boolean,
  female?: boolean,
): string | undefined {
  if (amenity === 'toilets') {
    return getBathroomImagePath(amenity, male, female);
  } else if (amenity === 'drinking_water') {
    return 'assets/images/water_fountain.png';
  }

  return undefined;
}

// Helper to get POI fill color based on amenity type
function getPoiFillColor(amenity: string, isHighlighted: boolean = true): string {
  const alpha = isHighlighted ? '0.15' : '0.05';
  switch (amenity) {
    case 'toilets':
      return `rgba(100, 150, 255, ${alpha})`;
    case 'drinking_water':
      return `rgba(100, 200, 255, ${alpha})`;
    default:
      return `rgba(100, 150, 255, ${alpha})`;
  }
}

// Helper to get POI stroke color based on amenity type
function getPoiStrokeColor(amenity: string, isHighlighted: boolean = true): string {
  const alpha = isHighlighted ? '0.6' : '0.2';
  switch (amenity) {
    case 'toilets':
      return `rgba(100, 150, 255, ${alpha})`;
    case 'drinking_water':
      return `rgba(100, 200, 255, ${alpha})`;
    default:
      return `rgba(100, 150, 255, ${alpha})`;
  }
}

// Helper to render point-based POI
function renderPointPoi(poi: IndoorPOI, isHighlighted: boolean): React.ReactNode {
  if (!poi.position) return null;

  const imagePath = getImagePathForAmenity(poi.amenity, poi.male, poi.female);
  const imageSource = getPoiImageSource(imagePath);

  if (!imageSource) return null;

  return (
    <PoiMarker
      key={poi.id}
      coordinate={poi.position}
      zIndex={15}
      opacity={isHighlighted ? 1.0 : 0.3}
    >
      <Image source={imageSource} style={labelStyles.poiIconImage} />
    </PoiMarker>
  );
}

// Helper to render polygon-based POI
function renderPolygonPoi(
  poi: IndoorPOI,
  isHighlighted: boolean,
  onPoiPress?: (poi: IndoorPOI) => void,
): React.ReactNode {
  if (!poi.polygon || poi.polygon.length <= 2 || !poi.centroid) return null;

  const poiColor = getPoiStrokeColor(poi.amenity, isHighlighted);
  const poiFillColor = getPoiFillColor(poi.amenity, isHighlighted);
  const imagePath = getImagePathForAmenity(poi.amenity, poi.male, poi.female);
  const imageSource = getPoiImageSource(imagePath);

  return (
    <React.Fragment key={poi.id}>
      <Polygon
        coordinates={poi.polygon}
        fillColor={poiFillColor}
        strokeColor={poiColor}
        strokeWidth={1.5}
        zIndex={5}
        tappable={!!onPoiPress}
        onPress={onPoiPress ? () => onPoiPress(poi) : undefined}
      />
      {imageSource && (
        <PoiMarker coordinate={poi.centroid} zIndex={12} opacity={isHighlighted ? 1.0 : 0.3}>
          <Image source={imageSource} style={labelStyles.poiIconImage} />
        </PoiMarker>
      )}
    </React.Fragment>
  );
}

// Helper to render POI feature (delegates to point or polygon rendering)
function renderPoiFeature(
  poi: IndoorPOI,
  isHighlighted: boolean,
  onPoiPress?: (poi: IndoorPOI) => void,
): React.ReactNode {
  // Point-based POIs (water fountains, etc.)
  if (poi.position && !poi.polygon) {
    return renderPointPoi(poi, isHighlighted);
  }
  // Polygon-based POIs (bathrooms, etc.)
  if (poi.polygon && poi.polygon.length > 2) {
    return renderPolygonPoi(poi, isHighlighted, onPoiPress);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Android marker fix – start tracking so the bitmap is captured after the
// Text lays out, then stop to avoid per-frame overhead.
// ---------------------------------------------------------------------------

function RoomLabelMarker({
  room,
  shortLabel,
  onPress,
}: Readonly<{
  room: IndoorRoom;
  shortLabel: string;
  onPress?: () => void;
}>) {
  const [tracked, setTracked] = useState(true);

  const handleLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      if (tracked) {
        setTimeout(() => setTracked(false), Platform.OS === 'ios' ? 250 : 100);
      }
    },
    [tracked],
  );

  return (
    <Marker
      coordinate={room.centroid}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracked}
      zIndex={10}
      onPress={onPress}
    >
      <View collapsable={false} onLayout={handleLayout} style={labelStyles.labelContainer}>
        <Text style={labelStyles.labelText} allowFontScaling={false}>
          {shortLabel}
        </Text>
      </View>
    </Marker>
  );
}

function IconMarker({
  coordinate,
  children,
  zIndex = 10,
  onPress,
  opacity,
}: Readonly<{
  coordinate: { latitude: number; longitude: number };
  children: React.ReactNode;
  zIndex?: number;
  onPress?: () => void;
  opacity?: number;
}>) {
  const [tracked, setTracked] = useState(true);

  const handleLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      if (tracked) {
        setTimeout(() => setTracked(false), Platform.OS === 'ios' ? 250 : 100);
      }
    },
    [tracked],
  );

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracked}
      zIndex={zIndex}
      onPress={onPress}
      opacity={opacity}
    >
      <View collapsable={false} onLayout={handleLayout} style={labelStyles.iconContainer}>
        {children}
      </View>
    </Marker>
  );
}

// POI Marker without dark background
function PoiMarker({
  coordinate,
  children,
  zIndex = 10,
  opacity,
}: Readonly<{
  coordinate: { latitude: number; longitude: number };
  children: React.ReactNode;
  zIndex?: number;
  opacity?: number;
}>) {
  const [tracked, setTracked] = useState(true);

  const handleLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      if (tracked) {
        setTimeout(() => setTracked(false), Platform.OS === 'ios' ? 250 : 100);
      }
    },
    [tracked],
  );

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracked}
      zIndex={zIndex}
      opacity={opacity}
    >
      <View collapsable={false} onLayout={handleLayout} style={labelStyles.poiMarkerContainer}>
        {children}
      </View>
    </Marker>
  );
}
// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IndoorMapOverlayProps {
  /** All indoor features for the active level. */
  activeLevelFeatures: IndoorFeature[];
  /** Optional indoor route to render on top. */
  route: IndoorRoute | null;
  /** Current active level (for filtering route segments). */
  activeLevel: string;
  /** Destination room (for the pin). */
  destinationRoom: ResolvedRoom | null;
  /** Currently selected room (highlighted). */
  selectedRoom?: ResolvedRoom | null;
  /** Callback when a room polygon is tapped. */
  onRoomPress?: (room: ResolvedRoom) => void;
  /** Callback when a POI, escalator, or elevator is tapped. */
  onPoiPress?: (
    poi:
      | IndoorPOI
      | (IndoorEscalator & { type: 'escalator' })
      | (IndoorElevator & { type: 'elevator' }),
  ) => void;
  /** Accent colour for the route line. */
  routeColor?: string;
  /** POI amenity types to display (e.g., ['toilets', 'drinking_water']). If undefined, all POIs are shown. */
  visiblePoiAmenities?: string[];
  /** Currently selected category filter ('washrooms', 'elevators', 'water_fountains', or null). */
  categoryFilter?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IndoorMapOverlay({
  activeLevelFeatures,
  route,
  activeLevel,
  destinationRoom,
  selectedRoom = null,
  onRoomPress,
  onPoiPress,
  routeColor = '#1a73e8',
  visiblePoiAmenities,
  categoryFilter,
}: Readonly<IndoorMapOverlayProps>) {
  // ---- Categorise features --------------------------------------------------
  const { outlines, areas, rooms, stairs, escalators, elevators, pois } = useMemo(() => {
    const out: IndoorLevelOutline[] = [];
    const ar: IndoorArea[] = [];
    const rm: IndoorRoom[] = [];
    const st: IndoorStairs[] = [];
    const es: IndoorEscalator[] = [];
    const ev: IndoorElevator[] = [];
    const po: IndoorPOI[] = [];

    for (const f of activeLevelFeatures) {
      switch (f.type) {
        case 'level_outline':
          out.push(f);
          break;
        case 'area':
          ar.push(f);
          break;
        case 'room':
          rm.push(f);
          break;
        case 'stairs':
          st.push(f);
          break;
        case 'escalator':
          es.push(f);
          break;
        case 'elevator':
          ev.push(f);
          break;
        case 'poi':
          po.push(f);
          break;
        default:
          break;
      }
    }

    return {
      outlines: out,
      areas: ar,
      rooms: rm,
      stairs: st,
      escalators: es,
      elevators: ev,
      pois: po,
    };
  }, [activeLevelFeatures]);

  // ---- Route polyline filtered to this level --------------------------------
  const routeSegmentsOnLevel = useMemo(() => {
    if (!route) return [];
    // Only render steps that stay entirely on this level.  Level-change
    // steps (elevator / stairs / escalator) span two floors and their
    // endpoint coordinates may differ per level due to node snapping,
    // producing spurious lines that cut through rooms.  The adjacent
    // walk steps already start/end at the transition point, so the
    // polyline is visually continuous without the level-change segment.
    return route.steps
      .filter((s) => s.fromLevel === activeLevel && s.toLevel === activeLevel)
      .flatMap((s) => s.path);
  }, [route, activeLevel]);

  // Calculate floor centroid to filter out duplicated off-screen multi-level features (e.g. elevators)
  // when handling side-by-side / misaligned map imports.
  const levelCentroid = useMemo(() => {
    let lat = 0,
      lng = 0,
      count = 0;
    for (const r of rooms) {
      // Ignore extreme outliers (e.g. a duplicated room 500m away) to ensure true central weight
      lat += r.centroid.latitude;
      lng += r.centroid.longitude;
      count++;
    }
    return count > 0 ? { latitude: lat / count, longitude: lng / count } : null;
  }, [rooms]);

  // Nothing to draw?
  if (activeLevelFeatures.length === 0) return null;

  // Key the entire batch by level + feature count.  This forces React to
  // unmount / remount all native map shapes when the level changes and
  // works around a react-native-maps bug where only a subset of Polygons
  // renders on the initial draw.
  const batchKey = `indoor-${activeLevel}-${activeLevelFeatures.length}`;

  return (
    <React.Fragment key={batchKey}>
      {/* 1. Level outlines — full floor boundary */}
      {outlines.map((f) =>
        f.polygon.length > 2 ? (
          <Polygon
            key={f.id}
            coordinates={f.polygon}
            fillColor={COLORS.outlineFill}
            strokeColor={COLORS.outlineStroke}
            strokeWidth={1}
            zIndex={1}
            tappable={false}
          />
        ) : null,
      )}

      {/* 2. Areas — open spaces */}
      {areas.map((f) =>
        f.polygon.length > 2 ? (
          <Polygon
            key={f.id}
            coordinates={f.polygon}
            fillColor={COLORS.areaFill}
            strokeColor={COLORS.outlineStroke}
            strokeWidth={0.5}
            zIndex={2}
            tappable={false}
          />
        ) : null,
      )}

      {/* 3. Rooms — tappable when onRoomPress is provided */}
      {(() => {
        // For rooms that are elevators/multi-level that duplicate across offset maps,
        // we only want to show the polygon meant for the current floor.
        const filteredRooms = rooms.filter((room) => {
          if (!room.ref || !levelCentroid) return true;
          // If this room has multiple identical copies in the `rooms` list (meaning it was parsed multiple times due to `level: x;y`),
          // we only keep the one closest to the current floor's visual centroid.
          if (/elevator/i.test(room.ref)) {
            const siblings = rooms.filter((r) => r.ref === room.ref);
            if (siblings.length > 1) {
              const bestSibling = siblings.reduce((best, curr) => {
                const dBest =
                  Math.pow(best.centroid.latitude - levelCentroid.latitude, 2) +
                  Math.pow(best.centroid.longitude - levelCentroid.longitude, 2);
                const dCurr =
                  Math.pow(curr.centroid.latitude - levelCentroid.latitude, 2) +
                  Math.pow(curr.centroid.longitude - levelCentroid.longitude, 2);
                return dCurr < dBest ? curr : best;
              });
              return room.id === bestSibling.id;
            }
          }
          return true;
        });

        return filteredRooms.map((room) => {
          if (room.polygon.length < 3) return null;
          const isSelected = selectedRoom?.featureId === room.id;
          return (
            <Polygon
              key={room.id}
              coordinates={room.polygon}
              holes={room.holes}
              fillColor={isSelected ? COLORS.roomSelectedFill : COLORS.roomFill}
              strokeColor={isSelected ? COLORS.roomSelectedStroke : COLORS.roomStroke}
              strokeWidth={isSelected ? 2 : 1}
              zIndex={3}
              tappable={!!onRoomPress && !!room.ref}
              onPress={
                onRoomPress && room.ref
                  ? () =>
                      onRoomPress({
                        featureId: room.id,
                        ref: room.ref!,
                        level: activeLevel,
                        position: room.centroid,
                        polygon: room.polygon,
                      })
                  : undefined
              }
            />
          );
        });
      })()}

      {/* 3b. Room number labels — placed at each room's centroid */}
      {(() => {
        const renderedRefs = new Set<string>();
        return rooms.map((room) => {
          if (!room.ref || room.polygon.length < 3) return null;
          // Prevent duplicate labels if a room has multiple polygons with the same ref
          if (renderedRefs.has(room.ref)) return null;
          renderedRefs.add(room.ref);

          // Strip building-code prefix for a shorter label (e.g. "H-840" → "840")
          let shortLabel = room.ref.replace(/^[A-Z]{1,3}-/i, '');
          // Abbreviate facility names so they fit Android's marker bitmap limit
          if (/^elevator/i.test(shortLabel)) return null;
          else if (/^bath-W/i.test(shortLabel)) shortLabel = 'WC ♀';
          else if (/^bath-M/i.test(shortLabel)) shortLabel = 'WC ♂';
          else if (/^bath/i.test(shortLabel)) shortLabel = 'WC';
          else if (/^stair/i.test(shortLabel)) shortLabel = 'Stairs';
          else if (/^escalator/i.test(shortLabel)) shortLabel = 'Esc.';
          return (
            <RoomLabelMarker
              key={`label-${room.ref}`}
              room={room}
              shortLabel={shortLabel}
              onPress={
                onRoomPress && room.ref
                  ? () =>
                      onRoomPress({
                        featureId: room.id,
                        ref: room.ref!,
                        level: activeLevel,
                        position: room.centroid,
                        polygon: room.polygon,
                      })
                  : undefined
              }
            />
          );
        });
      })()}

      {/* 4. Corridors — intentionally not rendered; rooms + outlines give
           sufficient context and the walkway lines add visual clutter. */}

      {/* 5. Stairs — area polygons + label */}
      {stairs.map((s) =>
        s.polygon.length > 2 ? (
          <React.Fragment key={s.id}>
            <Polygon
              coordinates={s.polygon}
              fillColor="rgba(180, 120, 40, 0.2)"
              strokeColor={COLORS.stairs}
              strokeWidth={1.5}
              zIndex={5}
              tappable={false}
            />
            <IconMarker
              coordinate={(() => {
                const sum = s.polygon.reduce(
                  (a, p) => ({
                    latitude: a.latitude + p.latitude,
                    longitude: a.longitude + p.longitude,
                  }),
                  { latitude: 0, longitude: 0 },
                );
                return {
                  latitude: sum.latitude / s.polygon.length,
                  longitude: sum.longitude / s.polygon.length,
                };
              })()}
              zIndex={10}
            >
              {/* Staircase icon — plain symbol, no background */}
              <Image
                source={require('../../assets/images/stairs.png')}
                style={labelStyles.iconImage}
              />
            </IconMarker>
          </React.Fragment>
        ) : null,
      )}

      {/* 6. Escalators — area polygons + label */}
      {escalators.map((e) => {
        const isHighlighted = categoryFilter === 'elevators' || categoryFilter === null;
        return e.polygon.length > 2 ? (
          <React.Fragment key={e.id}>
            <Polygon
              coordinates={e.polygon}
              fillColor={isHighlighted ? 'rgba(140, 100, 180, 0.2)' : 'rgba(140, 100, 180, 0.05)'}
              strokeColor={isHighlighted ? COLORS.escalator : 'rgba(140, 100, 180, 0.2)'}
              strokeWidth={1.5}
              zIndex={5}
              tappable={false}
            />
            <IconMarker
              coordinate={(() => {
                const sum = e.polygon.reduce(
                  (a, p) => ({
                    latitude: a.latitude + p.latitude,
                    longitude: a.longitude + p.longitude,
                  }),
                  { latitude: 0, longitude: 0 },
                );
                return {
                  latitude: sum.latitude / e.polygon.length,
                  longitude: sum.longitude / e.polygon.length,
                };
              })()}
              zIndex={10}
              onPress={onPoiPress ? () => onPoiPress({ ...e, type: 'escalator' }) : undefined}
              opacity={isHighlighted ? 1.0 : 0.3}
            >
              {/* Ramp/escalator icon — plain symbol, no background */}
              <Image
                source={require('../../assets/images/escalator.png')}
                style={labelStyles.iconImage}
              />
            </IconMarker>
          </React.Fragment>
        ) : null;
      })}

      {/* 6b. Elevators — one icon per unique shaft */}
      {(() => {
        // Group elevators by ref or physical proximity (for duplicate nodes added due to map misalignment)
        const groupedElevators: IndoorElevator[][] = [];

        for (const ev of elevators) {
          let foundGroup = false;
          for (const group of groupedElevators) {
            const leader = group[0];
            const sameRef = ev.ref && leader.ref && ev.ref === leader.ref;
            const sameLevels = ev.levels.join(',') === leader.levels.join(',');
            // Distance in degrees (approx 15-20 meters threshold)
            const dSq =
              Math.pow(ev.position.latitude - leader.position.latitude, 2) +
              Math.pow(ev.position.longitude - leader.position.longitude, 2);
            const isClose = dSq < 0.0000005; // ~7 meters

            if (sameRef || (sameLevels && isClose)) {
              group.push(ev);
              foundGroup = true;
              break;
            }
          }
          if (!foundGroup) {
            groupedElevators.push([ev]);
          }
        }

        const isHall =
          elevators.some((e) => e.ref?.startsWith('H-')) ||
          rooms.some((r) => r.ref?.startsWith('H-'));
        const bestElevators = isHall
          ? elevators
          : groupedElevators.map((group) => {
              if (group.length === 1 || !levelCentroid) return group[0];
              // If multiple points exist for the same shaft, pick the one closest to the active floor's true centroid
              return group.reduce((best, curr) => {
                const dBest =
                  Math.pow(best.position.latitude - levelCentroid.latitude, 2) +
                  Math.pow(best.position.longitude - levelCentroid.longitude, 2);
                const dCurr =
                  Math.pow(curr.position.latitude - levelCentroid.latitude, 2) +
                  Math.pow(curr.position.longitude - levelCentroid.longitude, 2);
                return dCurr < dBest ? curr : best;
              });
            });

        return bestElevators.map((ev) => {
          const isHighlighted = categoryFilter === 'elevators' || categoryFilter === null;
          return (
            <IconMarker
              key={ev.id}
              coordinate={ev.position}
              zIndex={15}
              onPress={onPoiPress ? () => onPoiPress({ ...ev, type: 'elevator' }) : undefined}
              opacity={isHighlighted ? 1.0 : 0.3}
            >
              <Image
                source={require('../../assets/images/elevator.png')}
                style={labelStyles.iconImage}
              />
            </IconMarker>
          );
        });
      })()}

      {/* 6c. POIs (bathrooms, water fountains, etc.) */}
      {pois.map((poi) => {
        const isHighlighted = !visiblePoiAmenities || visiblePoiAmenities.includes(poi.amenity);
        return renderPoiFeature(poi, isHighlighted, onPoiPress);
      })}

      {/* 7. Indoor route polyline — Google Maps style with border + fill */}
      {routeSegmentsOnLevel.length > 1 && (
        <>
          {/* Outer border / glow */}
          <Polyline
            coordinates={routeSegmentsOnLevel}
            strokeColor="rgba(10, 50, 120, 0.45)"
            strokeWidth={8}
            zIndex={19}
          />
          {/* Main route line */}
          <Polyline
            coordinates={routeSegmentsOnLevel}
            strokeColor={routeColor}
            strokeWidth={5}
            zIndex={20}
          />
        </>
      )}

      {/* 8. Destination pin */}
      {destinationRoom && (
        <Marker
          coordinate={destinationRoom.position}
          title={destinationRoom.ref}
          pinColor="#1a73e8"
          zIndex={30}
        />
      )}
    </React.Fragment>
  );
}

// ---------------------------------------------------------------------------
// Label styles
// ---------------------------------------------------------------------------

const labelStyles = StyleSheet.create({
  labelContainer: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120,140,170,0.5)',
  },
  labelText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  // Wrapper used by IconMarker — dark circle so the white icon stands out on the map
  iconContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 14,
    padding: 5,
  },
  // PNG icon rendered directly on the map — white tint so it reads against the dark circle
  iconImage: {
    width: 14,
    height: 14,
    tintColor: '#fff',
  },
  // POI icon styles — no tint color since POI images are pre-colored
  poiIconImage: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  // POI marker wrapper — ensures proper sizing and centering without clipping
  poiMarkerContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
