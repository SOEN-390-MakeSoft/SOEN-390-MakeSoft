/*
 * This test suite covers purely system tests, it verifies the navigation and
 * backend endpoint contract at the system boundary through api.ts.
 *
 * It validates request/response behavior for navigation-related API calls.
 * Host resolution matrix is intentionally covered in NetworkResolver.test.tsx,
 * so this suite stays focused on endpoint contract behavior only.
 */
type PlatformOS = 'android' | 'ios';

type ApiMockOptions = {
  os?: PlatformOS;
  isDevice?: boolean;
  pcIp?: string | null;
  mockGet: jest.Mock;
};

const loadApiModule = ({
  os = 'android',
  isDevice = false,
  pcIp = null,
  mockGet,
}: ApiMockOptions) => {
  jest.doMock('react-native', () => ({ Platform: { OS: os } }));
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: {
      isDevice,
      expoConfig: { extra: { PC_IP: pcIp } },
    },
  }));
  jest.doMock('axios', () => ({
    __esModule: true,
    default: {
      create: () => ({ get: mockGet }),
    },
  }));

  return require('../../services/api') as typeof import('../../services/api');
};

describe('Testing Navigation API System Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should report successful health connection when backend responds with success', async () => {
    const mockGet = jest.fn().mockResolvedValue({ data: { status: 'UP' } });

    const { testConnection } = loadApiModule({
      os: 'android',
      isDevice: false,
      pcIp: null,
      mockGet,
    });
    const result = await testConnection();

    expect(mockGet).toHaveBeenCalledWith('/health');
    expect(result).toEqual({ success: true, data: { status: 'UP' } });
  });

  it('should call building endpoint correctly and return mapped building payload', async () => {
    const mockBuilding = {
      id: 9,
      name: 'Hall Building',
      code: 'H',
      address: '1455 De Maisonneuve Blvd W',
      campus: 'SGW',
      hasElevator: true,
      hasAccessibility: true,
      hasMetroAccess: true,
    };
    const mockGet = jest.fn().mockResolvedValue({ data: mockBuilding });

    const { getBuildingById } = loadApiModule({
      os: 'android',
      isDevice: true,
      pcIp: '192.168.0.50',
      mockGet,
    });
    const building = await getBuildingById(9);

    expect(mockGet).toHaveBeenCalledWith('/buildings/9');
    expect(building).toEqual(mockBuilding);
  });

  it('should send rounded shuttle params including date override and return shuttle payload', async () => {
    const mockShuttleResponse = {
      threeNextShuttles: ['2026-02-22T10:05:00Z', null, null],
      tripDuration: 32,
    };
    const mockGet = jest.fn().mockResolvedValue({ data: mockShuttleResponse });

    const { getNextShuttles } = loadApiModule({
      os: 'ios',
      isDevice: true,
      pcIp: '10.20.30.40:9999',
      mockGet,
    });
    const result = await getNextShuttles('SGW', 7.6, '2026-02-22T10:00:00Z');

    expect(mockGet).toHaveBeenCalledWith('/shuttle/next', {
      params: {
        departureCampus: 'SGW',
        offMinutes: 8,
        dateTime: '2026-02-22T10:00:00Z',
      },
    });
    expect(result).toEqual(mockShuttleResponse);
  });

  it('should report a clean failure response when backend health check throws', async () => {
    const mockGet = jest.fn().mockRejectedValue(new Error('timeout while reaching backend'));

    const { testConnection } = loadApiModule({
      os: 'ios',
      isDevice: false,
      pcIp: null,
      mockGet,
    });
    const result = await testConnection();

    expect(result).toEqual({
      success: false,
      error: 'timeout while reaching backend',
    });
  });
});
