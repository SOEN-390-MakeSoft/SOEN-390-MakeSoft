/* 
 * This test suite covers purely system tests, it verifies the api logic exclusively in
 * api.ts (where the connection occurs to the backend) as its the main interaction point 
 * for the frontend as a system. Its purpose is to verify the system configuration logic 
 * (Network/OS/Env) without rendering any UI components or running an E2E environment.
*/
describe('Testing Network Configuration Logic', () => {
    
    // Run before every test case as a setup
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules(); // Need this since our tests use require().
    });

    /*
     * System Scenario 1: Android Emulator (On PC)
    */
    it('should configure for the anroid emulator host address, i.e. 10.0.2.2:8080', () => {
        
        // Build Mocks
        jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
        jest.doMock('expo-constants', () => ({ 
            default: { 
                isDevice: false, 
                expoConfig: { extra: { PC_IP: null } }
            } 
        }));

        // Pretend that api.ts has just been opened by a user
        const { API_BASE_URL } = require('../../services/api');

        // The Host IP is expected to be the host machine's local host in conjuction with the backend API (Android behaviour)
        expect(API_BASE_URL).toBe('http://10.0.2.2:8080/api');
    });

    /*
     * System Scenario 2: iOS Emulator (On PC)
    */
    it('should configure for the iOS emulator host address, i.e. localhost:8080', () => {

            // Build Mocks
            jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
            jest.doMock('expo-constants', () => ({ 
            default: { 
                isDevice: false, 
                expoConfig: { extra: { PC_IP: null } }
            } 
        }));

        // Pretend that api.ts has just been opened by a user
        const { API_BASE_URL } = require('../../services/api');

        // The emulator URL is expected to share the host network's in conjuction with the backend API (iOS behaviour)
        expect(API_BASE_URL).toBe('http://localhost:8080/api');
    });

    /*
     * System Scenario 3: Physical Phone that uses the configured IP from env variables
    */ 
    it('should use the configured IP (i.e. PC_IP)', () => {
        // Define a fake IP that will acta as our android phone
        const MOCK_PC_IP = "test-ip"

        // Build Mocks
        jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
        jest.doMock('expo-constants', () => { 
            const MockConstants = { 
                isDevice: true, 
                expoConfig: { extra: { PC_IP: MOCK_PC_IP } }
            };
            return {
                __esModule: true,
                default: MockConstants
            }
        });

        // Pretend that api.ts has just been opened by a user
        const { API_BASE_URL } = require('../../services/api');

        // The logic should append the specified port (:8080, in this case) to the end of the IP
        expect(API_BASE_URL).toBe(`http://${MOCK_PC_IP}:8080/api`);

    });

    /*
     * System Scenario 4: Physical Phone that has the port included in its env var
    */ 
    it('should leave port as is', () => {
        // Define a fake IP that will acta as our android phone
        const MOCK_PC_IP_WITH_PORT = "test-ip:1000"

        // Build Mocks
        jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
        jest.doMock('expo-constants', () => {
            const MockConstants = { 
                isDevice: true, 
                expoConfig: { extra: { PC_IP: MOCK_PC_IP_WITH_PORT } }
            };
            return {
                __esModule: true,
                default: MockConstants
            }
        });

        // Pretend that api.ts has just been opened by a user
        const { API_BASE_URL } = require('../../services/api');

        // The logic should should respect the specified port
        expect(API_BASE_URL).toBe(`http://${MOCK_PC_IP_WITH_PORT}/api`);
    });
});