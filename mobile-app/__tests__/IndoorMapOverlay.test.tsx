import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import IndoorMapOverlay from '../components/indoor/IndoorMapOverlay';
import type { ResolvedRoom } from '../services/indoor/roomResolver';
import type {
  IndoorArea,
  IndoorElevator,
  IndoorEscalator,
  IndoorFeature,
  IndoorLevelOutline,
  IndoorPOI,
  IndoorRoom,
  IndoorRoute,
  IndoorStairs,
} from '../services/indoor/types';

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');

  return {
    __esModule: true,
    default: ({ children, ...props }: any) =>
      React.createElement(View, { ...props, testID: props.testID ?? 'map-view' }, children),
    Marker: ({ children, ...props }: any) =>
      React.createElement(Pressable, { ...props, testID: props.testID ?? 'marker' }, children),
    Polygon: ({ children, ...props }: any) =>
      React.createElement(Pressable, { ...props, testID: props.testID ?? 'polygon' }, children),
    Polyline: (props: any) =>
      React.createElement(View, { ...props, testID: props.testID ?? 'polyline' }),
  };
});

const outline: IndoorLevelOutline = {
  id: 'outline-1',
  type: 'level_outline',
  levels: ['1'],
  ref: null,
  raw: {},
  name: 'Level 1',
  polygon: [
    { latitude: 45.5, longitude: -73.58 },
    { latitude: 45.5, longitude: -73.579 },
    { latitude: 45.499, longitude: -73.579 },
    { latitude: 45.499, longitude: -73.58 },
  ],
};

const area: IndoorArea = {
  id: 'area-1',
  type: 'area',
  levels: ['1'],
  ref: 'open-area',
  raw: {},
  polygon: [
    { latitude: 45.4999, longitude: -73.5799 },
    { latitude: 45.4999, longitude: -73.5797 },
    { latitude: 45.4997, longitude: -73.5797 },
    { latitude: 45.4997, longitude: -73.5799 },
  ],
};

const room: IndoorRoom = {
  id: 'room-101',
  type: 'room',
  levels: ['1'],
  ref: 'H-101',
  raw: {},
  centroid: { latitude: 45.4996, longitude: -73.5798 },
  polygon: [
    { latitude: 45.49965, longitude: -73.57985 },
    { latitude: 45.49965, longitude: -73.57975 },
    { latitude: 45.49955, longitude: -73.57975 },
    { latitude: 45.49955, longitude: -73.57985 },
  ],
};

const stairs: IndoorStairs = {
  id: 'stairs-1',
  type: 'stairs',
  levels: ['1', '2'],
  ref: 'H-stair-1',
  raw: {},
  polygon: [
    { latitude: 45.49955, longitude: -73.57965 },
    { latitude: 45.49955, longitude: -73.5796 },
    { latitude: 45.4995, longitude: -73.5796 },
    { latitude: 45.4995, longitude: -73.57965 },
  ],
  path: [],
  oneway: null,
};

const escalator: IndoorEscalator = {
  id: 'escalator-1',
  type: 'escalator',
  levels: ['1', '2'],
  ref: 'H-escalator-1',
  raw: {},
  polygon: [
    { latitude: 45.49945, longitude: -73.57955 },
    { latitude: 45.49945, longitude: -73.5795 },
    { latitude: 45.4994, longitude: -73.5795 },
    { latitude: 45.4994, longitude: -73.57955 },
  ],
  path: [],
  oneway: null,
};

const elevator: IndoorElevator = {
  id: 'elevator-1',
  type: 'elevator',
  levels: ['1', '2'],
  ref: 'H-elevator-1',
  raw: {},
  position: { latitude: 45.49935, longitude: -73.57945 },
};

const pointPoi: IndoorPOI = {
  id: 'poi-water-1',
  type: 'poi',
  levels: ['1'],
  ref: 'water-1',
  raw: {},
  amenity: 'drinking_water',
  name: 'Water Fountain',
  position: { latitude: 45.4993, longitude: -73.5794 },
};

const polygonPoi: IndoorPOI = {
  id: 'poi-toilet-1',
  type: 'poi',
  levels: ['1'],
  ref: 'bath-1',
  raw: {},
  amenity: 'toilets',
  name: 'Washroom',
  male: true,
  female: true,
  polygon: [
    { latitude: 45.49925, longitude: -73.57935 },
    { latitude: 45.49925, longitude: -73.5793 },
    { latitude: 45.4992, longitude: -73.5793 },
    { latitude: 45.4992, longitude: -73.57935 },
  ],
  centroid: { latitude: 45.499225, longitude: -73.579325 },
};

const selectedRoom: ResolvedRoom = {
  featureId: room.id,
  ref: room.ref!,
  level: '1',
  position: room.centroid,
  polygon: room.polygon,
};

const destinationRoom: ResolvedRoom = {
  featureId: 'destination-1',
  ref: 'H-105',
  level: '1',
  position: { latitude: 45.49915, longitude: -73.57915 },
  polygon: [],
};

const route: IndoorRoute = {
  totalDistanceMeters: 25,
  totalEstimatedSeconds: 30,
  nodeIds: ['a', 'b', 'c'],
  polyline: [
    { latitude: 45.4996, longitude: -73.5798 },
    { latitude: 45.4994, longitude: -73.5796 },
    { latitude: 45.4992, longitude: -73.5794 },
  ],
  steps: [
    {
      fromLevel: '1',
      toLevel: '1',
      path: [
        { latitude: 45.4996, longitude: -73.5798 },
        { latitude: 45.4994, longitude: -73.5796 },
      ],
    },
    {
      fromLevel: '1',
      toLevel: '2',
      path: [
        { latitude: 45.4994, longitude: -73.5796 },
        { latitude: 45.4992, longitude: -73.5794 },
      ],
    },
  ] as any,
  startLevel: '1',
  endLevel: '2',
};

const features: IndoorFeature[] = [
  outline,
  area,
  room,
  stairs,
  escalator,
  elevator,
  pointPoi,
  polygonPoi,
];

describe('IndoorMapOverlay', () => {
  it('renders nothing when there are no active level features', () => {
    const { queryByTestId } = render(
      <IndoorMapOverlay
        activeLevelFeatures={[]}
        route={null}
        activeLevel="1"
        destinationRoom={null}
      />,
    );

    expect(queryByTestId('polygon')).toBeNull();
    expect(queryByTestId('marker')).toBeNull();
    expect(queryByTestId('polyline')).toBeNull();
  });

  it('renders map layers and wires room, POI, and route interactions', () => {
    const onRoomPress = jest.fn();
    const onPoiPress = jest.fn();

    const { getAllByTestId, getByTestId } = render(
      <IndoorMapOverlay
        activeLevelFeatures={features}
        route={route}
        activeLevel="1"
        destinationRoom={destinationRoom}
        selectedRoom={selectedRoom}
        onRoomPress={onRoomPress}
        onPoiPress={onPoiPress}
        visiblePoiAmenities={['toilets']}
        categoryFilter="elevators"
        isColorBlind
      />,
    );

    const roomPolygon = getAllByTestId('polygon').find((node) => node.props.strokeWidth === 2);
    expect(roomPolygon).toBeTruthy();
    fireEvent.press(roomPolygon!);
    expect(onRoomPress).toHaveBeenCalledWith({
      featureId: room.id,
      ref: 'H-101',
      level: '1',
      position: room.centroid,
      polygon: room.polygon,
    });

    expect(getByTestId('poi-drinking_water-0').props.opacity).toBe(0.3);
    expect(getByTestId('poi-toilets-0').props.opacity).toBe(1);

    fireEvent.press(getByTestId('poi-drinking_water-0'));
    fireEvent.press(getByTestId('poi-toilets-0'));
    expect(onPoiPress).toHaveBeenNthCalledWith(1, pointPoi);
    expect(onPoiPress).toHaveBeenNthCalledWith(2, polygonPoi);

    const elevatorMarker = getAllByTestId('marker').find(
      (node) =>
        node.props.coordinate?.latitude === elevator.position.latitude &&
        node.props.coordinate?.longitude === elevator.position.longitude,
    );
    expect(elevatorMarker?.props.opacity).toBe(1);
    fireEvent.press(elevatorMarker!);
    expect(onPoiPress).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ id: elevator.id, type: 'elevator' }),
    );

    const routePolylines = getAllByTestId('polyline');
    expect(routePolylines).toHaveLength(2);
    expect(routePolylines[0].props.coordinates).toEqual(route.steps[0].path);
    expect(routePolylines[1].props.coordinates).toEqual(route.steps[0].path);

    const destinationMarker = getAllByTestId('marker').find((node) => node.props.title === 'H-105');
    expect(destinationMarker).toBeTruthy();
  });
});
