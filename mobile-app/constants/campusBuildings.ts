/**
 * Main buildings per campus for the map footer.
 * Each campus has exactly 4 main buildings shown as quick-access cards.
 */

export type CampusId = 'SGW' | 'Loyola';

export interface MainBuilding {
  id: string;
  name: string;
  code: string; // Building code(s) shown on campus, e.g. "H", "HA, HB, HC"
  description?: string;
}

export interface CampusBuildings {
  id: CampusId;
  name: string;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  buildings: MainBuilding[];
}

export const CAMPUS_BUILDINGS: Record<CampusId, CampusBuildings> = {
  SGW: {
    id: 'SGW',
    name: 'SGW Campus',
    region: {
      latitude: 45.4973,
      longitude: -73.5789,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    },
    buildings: [
      {
        id: 'hall',
        name: 'Henry F. Hall Building',
        code: 'H',
        description: 'Central building housing classrooms, offices, and student services.',
      },
      {
        id: 'molson',
        name: 'John Molson Building',
        code: 'MB',
        description: 'Home to the John Molson School of Business.',
      },
      {
        id: 'ev',
        name: 'Engineering, Computer Science and Visual Arts Integrated Complex',
        code: 'EV',
        description: 'Engineering, Computer Science and Visual Arts facilities.',
      },
      {
        id: 'mcconnell',
        name: 'J.W. McConnell Building',
        code: 'LB',
        description: 'Library and learning commons.',
      },
    ],
  },
  Loyola: {
    id: 'Loyola',
    name: 'Loyola Campus',
    region: {
      latitude: 45.4582,
      longitude: -73.6405,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    },
    buildings: [
      {
        id: 'hingston',
        name: 'Hingston Hall',
        code: 'HA, HB, HC',
        description: 'Multi-wing building with HA, HB, and HC wings.',
      },
      {
        id: 'vanier',
        name: 'Vanier Library Building',
        code: 'VL',
        description: 'Loyola campus library and study spaces.',
      },
      {
        id: 'renaud',
        name: 'Richard J. Renaud Science Complex',
        code: 'SP',
        description: 'Science facilities and labs.',
      },
      {
        id: 'cj',
        name: 'Communication Studies and Journalism Building',
        code: 'CJ',
        description: 'Department of Communication Studies and Journalism.',
      },
    ],
  },
};

export const CAMPUS_IDS: CampusId[] = ['SGW', 'Loyola'];
