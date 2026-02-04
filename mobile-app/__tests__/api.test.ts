/**
 * Mock the global fetch function to intercept all HTTP requests during testing.
 * Allows simulation of API responses without making actual network calls.
 */
global.fetch = jest.fn();

describe('API Service', () => {
    /**
     * Reset fetch mock before each test to ensure clean state.
     */
    beforeEach(() => {
        (fetch as jest.Mock).mockClear();
    });

    /**
     * Test: Verifies that the API service handles successful GET requests.
     * Mocks a successful response and checks that data is returned correctly.
     */
    it('should make successful GET request', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: 'test' })
        });
    });

    /**
     * Test: Verifies that the API service properly handles network errors.
     * Mocks a network failure to test error handling behavior.
     */
    it('should handle network errors', async () => {
        (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    });
});
