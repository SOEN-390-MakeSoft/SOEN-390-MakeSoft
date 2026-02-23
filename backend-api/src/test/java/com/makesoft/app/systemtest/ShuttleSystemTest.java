package com.makesoft.app.systemtest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;


/*
 * This class is for System tests related to the shuttle API endpoint (in ShuttleController) and expected 
 * responses based on requirements for outdoor navigation support. This specifically tests the behavior of
 * the backend entry point as a black box (HTTP request -> controller validation -> service -> JSON response).
 *
 * This IS NOT testing internal implementation details and this IS NOT an E2E test.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public class ShuttleSystemTest {

    @Autowired
    private TestRestTemplate restTemplate;

    /*
     * Test to ensure shuttle endpoint returns 200 and correct payload shape
     * for a valid weekday request with deterministic date/time.
     */
    @Test
    void testGetNextShuttle_Returns200AndExpectedJsonShape() {

        /* System test:
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status
         * response forcibly as a Java String.
         * ResponseEntity contains:
         *      The Status Code (e.g., 200 OK, 400 Bad Request),
         *      The Headers (e.g., Content-Type: application/json),
         *      The Body The actual data, stored as a String.
         */
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/shuttle/next?departureCampus=SGW&offMinutes=0&dateTime=2026-02-16T09:00:00",
                String.class);

        // Asserting the software requirement that a valid shuttle request should return HTTP 200 OK
        assertEquals(HttpStatus.OK, response.getStatusCode());

        // Asserting the payload contract expected by mobile-app navigation flow
        assertThat(response.getBody())
                .contains("threeNextShuttles")
                .contains("tripDuration")
                .contains("2026-02-16T09:30:00")
                .contains("2026-02-16T09:45:00")
                .contains("2026-02-16T10:00:00");
    }

    // Test to check the system's ability to handle invalid campus values gracefully
    @Test
    void testGetNextShuttle_InvalidCampus_Returns400() {

        /* System test:
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status
         * response forcibly as a Java String.
         */
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/shuttle/next?departureCampus=INVALID&offMinutes=0&dateTime=2026-02-16T09:00:00",
                String.class);

        // Asserting the software requirement that invalid campus input should be rejected with 400
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    // Test to check the system's ability to reject invalid negative offset values
    @Test
    void testGetNextShuttle_NegativeOffset_Returns400() {

        /* System test:
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status
         * response forcibly as a Java String.
         */
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/shuttle/next?departureCampus=SGW&offMinutes=-5&dateTime=2026-02-16T09:00:00",
                String.class);

        // Asserting the software requirement that negative offMinutes should be rejected with 400
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    // Test to check the system's ability to reject malformed date-time values
    @Test
    void testGetNextShuttle_InvalidDateTime_Returns400() {

        /* System test:
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status
         * response forcibly as a Java String.
         */
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/shuttle/next?departureCampus=LOY&offMinutes=10&dateTime=bad-date-format",
                String.class);

        // Asserting the software requirement that malformed date input should be rejected with 400
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    // Test to verify weekend behavior required by schedule rules (no shuttles should be available)
    @Test
    void testGetNextShuttle_Weekend_ReturnsNullSlots() {

        /* System test:
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status
         * response forcibly as a Java String.
         */
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/shuttle/next?departureCampus=LOY&offMinutes=0&dateTime=2026-02-22T10:00:00",
                String.class);

        // Asserting the software requirement that weekend schedule should return three null shuttle slots
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertThat(response.getBody())
                .contains("threeNextShuttles")
                .contains("null")
                .contains("\"tripDuration\":30");
    }
}
