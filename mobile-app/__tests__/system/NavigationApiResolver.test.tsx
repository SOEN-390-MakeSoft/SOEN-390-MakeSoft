/*
 * This test suite covers purely system tests, it verifies the navigation and
 * backend endpoint contract at the system boundary through api.ts.
 *
 * It validates request/response behavior for navigation-related API calls.
 * Host resolution matrix is intentionally covered in NetworkResolver.test.tsx,
 * so this suite stays focused on endpoint contract behavior only.
 */
describe('Testing Navigation API System Logic', () => {
  // Run before every test case as a setup
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Need this since our tests use require().
  });

  /*
  * System Scenario 1: Health endpoint successful response
   */
  it('should report successful health connection when backend responds with success', async () => {
    // jest.fn() creates a fake function we can control and inspect.
    // Here, we fake axios.get so it returns a resolved Promise (successful API call)
    // with the same shape the real backend would return: { data: { ... } }.
    // Because it is a mock, we can later assert exactly how it was called.
    const mockGet = jest.fn().mockResolvedValue({ data: { status: 'UP' } });

    // Build Mocks
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        isDevice: false,
        expoConfig: { extra: { PC_IP: null } },
      },
    }));
    jest.doMock('axios', () => ({
      __esModule: true,
      default: {
        create: () => ({
          get: mockGet,
        }),
      },
    }));

    // Pretend that api.ts has just been opened by a user
    const { testConnection } = require('../../services/api');
    const result = await testConnection();

    // The endpoint contract should call the expected route and keep success shape
    expect(mockGet).toHaveBeenCalledWith('/health');
    expect(result).toEqual({ success: true, data: { status: 'UP' } });
  });

  /*
  * System Scenario 2: Building lookup endpoint contract
   */
  it('should call building endpoint correctly and return mapped building payload', async () => {
    const MOCK_PC_IP = '192.168.0.50';
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

    // jest.fn() creates a fake axios.get implementation for this test only.
    // mockResolvedValue(...) means: when getBuildingById calls axios.get,
    // return a successful Promise containing this building object in response.data.
    // This lets us test request/response contract without a real backend server.
    const mockGet = jest.fn().mockResolvedValue({ data: mockBuilding });

    // Build Mocks
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        isDevice: true,
        expoConfig: { extra: { PC_IP: MOCK_PC_IP } },
      },
    }));
    jest.doMock('axios', () => ({
      __esModule: true,
      default: {
        create: () => ({
          get: mockGet,
        }),
      },
    }));

    // Pretend that api.ts has just been opened by a user
    const { getBuildingById } = require('../../services/api');
    const building = await getBuildingById(9);

    // The endpoint contract should target /buildings/:id and return backend payload
    expect(mockGet).toHaveBeenCalledWith('/buildings/9');
    expect(building).toEqual(mockBuilding);
  });

  /*
  * System Scenario 3: Shuttle endpoint parameter contract
   */
  it('should send rounded shuttle params including date override and return shuttle payload', async () => {
    const MOCK_PC_IP_WITH_PORT = '10.20.30.40:9999';
    const mockShuttleResponse = {
      threeNextShuttles: ['2026-02-22T10:05:00Z', null, null],
      tripDuration: 32,
    };

    // jest.fn() gives us a controllable fake for axios.get.
    // We configure it to resolve with shuttle data so we can verify two things:
    // 1) the exact params sent to /shuttle/next, and
    // 2) that api.ts returns the backend payload unchanged.
    const mockGet = jest.fn().mockResolvedValue({ data: mockShuttleResponse });

    // Build Mocks
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        isDevice: true,
        expoConfig: { extra: { PC_IP: MOCK_PC_IP_WITH_PORT } },
      },
    }));
    jest.doMock('axios', () => ({
      __esModule: true,
      default: {
        create: () => ({
          get: mockGet,
        }),
      },
    }));

    // Pretend that api.ts has just been opened by a user
    const { getNextShuttles } = require('../../services/api');
    const result = await getNextShuttles('SGW', 7.6, '2026-02-22T10:00:00Z');

    // The endpoint contract should preserve query params expected by backend
    expect(mockGet).toHaveBeenCalledWith('/shuttle/next', {
      params: {
        departureCampus: 'SGW',
        offMinutes: 8,
        dateTime: '2026-02-22T10:00:00Z',
      },
    });
    expect(result).toEqual(mockShuttleResponse);
  });

  /*
   * System Scenario 4: Backend connectivity failure flow
   */
  it('should report a clean failure response when backend health check throws', async () => {
    // jest.fn() again creates a fake axios.get, but this time we force it to fail.
    // mockRejectedValue(...) means the Promise rejects with this Error,
    // simulating a real network/backend failure path.
    // This allows us to verify that testConnection returns a safe, user-friendly
    // error object instead of crashing.
    const mockGet = jest.fn().mockRejectedValue(new Error('timeout while reaching backend'));

    // Build Mocks
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        isDevice: false,
        expoConfig: { extra: { PC_IP: null } },
      },
    }));
    jest.doMock('axios', () => ({
      __esModule: true,
      default: {
        create: () => ({
          get: mockGet,
        }),
      },
    }));

    // Pretend that api.ts has just been opened by a user
    const { testConnection } = require('../../services/api');
    const result = await testConnection();

    // The endpoint contract should return user-friendly error shape on failure
    expect(result).toEqual({
      success: false,
      error: 'timeout while reaching backend',
    });
  });
});
