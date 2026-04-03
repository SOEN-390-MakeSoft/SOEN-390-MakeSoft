package com.makesoft.app.systemtest;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;


/*
 * This class is for System tests related to the shuttle API endpoint (in ShuttleController) and expected 
 * responses based on requirements for outdoor navigation support. This specifically tests the behavior of
 * the backend entry point as a black box (HTTP request -> controller validation -> service -> JSON response).
 *
 * This IS NOT testing internal implementation details and this IS NOT an E2E test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:testdb",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect"
})
public class ShuttleSystemTest {

    @Autowired
    private MockMvc mockMvc;

    /*
     * Test to ensure shuttle endpoint returns 200 and correct payload shape
     * for a valid weekday request with deterministic date/time.
     */
    @Test
    void testGetNextShuttle_Returns200AndExpectedJsonShape() throws Exception {

        /* System test:
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status
         * response forcibly as a Java String.
         * ResponseEntity contains:
         *      The Status Code (e.g., 200 OK, 400 Bad Request),
         *      The Headers (e.g., Content-Type: application/json),
         *      The Body The actual data, stored as a String.
         */
        mockMvc.perform(get("/api/shuttle/next")
                        .param("departureCampus", "SGW")
                        .param("offMinutes", "0")
                        .param("dateTime", "2026-02-16T09:00:00"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("threeNextShuttles")))
                .andExpect(content().string(containsString("tripDuration")))
                .andExpect(content().string(containsString("2026-02-16T09:30:00")))
                .andExpect(content().string(containsString("2026-02-16T09:45:00")))
                .andExpect(content().string(containsString("2026-02-16T10:00:00")));
    }

    // Test to check the system's ability to handle invalid campus values gracefully
    @Test
    void testGetNextShuttle_InvalidCampus_Returns400() throws Exception {

        /* System test:
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status
         * response forcibly as a Java String.
         */
        mockMvc.perform(get("/api/shuttle/next")
                        .param("departureCampus", "INVALID")
                        .param("offMinutes", "0")
                        .param("dateTime", "2026-02-16T09:00:00"))
                .andExpect(status().isBadRequest());
    }

    // Test to check the system's ability to reject invalid negative offset values
    @Test
    void testGetNextShuttle_NegativeOffset_Returns400() throws Exception {

        /* System test:
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status
         * response forcibly as a Java String.
         */
        mockMvc.perform(get("/api/shuttle/next")
                        .param("departureCampus", "SGW")
                        .param("offMinutes", "-5")
                        .param("dateTime", "2026-02-16T09:00:00"))
                .andExpect(status().isBadRequest());
    }

    // Test to check the system's ability to reject malformed date-time values
    @Test
    void testGetNextShuttle_InvalidDateTime_Returns400() throws Exception {

        /* System test:
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status
         * response forcibly as a Java String.
         */
        mockMvc.perform(get("/api/shuttle/next")
                        .param("departureCampus", "LOY")
                        .param("offMinutes", "10")
                        .param("dateTime", "bad-date-format"))
                .andExpect(status().isBadRequest());
    }

    // Test to verify weekend behavior required by schedule rules (no shuttles should be available)
    @Test
    void testGetNextShuttle_Weekend_ReturnsNullSlots() throws Exception {

        /* System test:
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status
         * response forcibly as a Java String.
         */
        mockMvc.perform(get("/api/shuttle/next")
                        .param("departureCampus", "LOY")
                        .param("offMinutes", "0")
                        .param("dateTime", "2026-02-22T10:00:00"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("threeNextShuttles")))
                .andExpect(content().string(containsString("null")))
                .andExpect(content().string(containsString("\"tripDuration\":30")));
    }
}
