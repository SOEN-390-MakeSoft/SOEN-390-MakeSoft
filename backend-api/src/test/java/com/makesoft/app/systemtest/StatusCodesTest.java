package com.makesoft.app.systemtest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import com.makesoft.app.infrastructure.persistence.entity.BuildingEntity;
import com.makesoft.app.infrastructure.persistence.springdata.BuildingJpaRepository;

/*
 * This class is for System tests related to API calls and expected responses based on the requirements expected
 * in this project. This specifically tests the behaviour of the entry point, this IS NOT testing the code itself,
 * just checks if the entire backend system is behaving as expected.
*/
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public class StatusCodesTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private BuildingJpaRepository buildingJpaRepository;

    @MockitoSpyBean
    private JdbcTemplate jdbcTemplate;

    /*
     * Need to populate the in memory database in order to correctly isolate the backend.
     * This allows for black-box system testing when requesting backend api services.
     * This is confifgured to run befor every test.
     */
    @BeforeEach
    void setup() {
        buildingJpaRepository.deleteAll();

        BuildingEntity building = new BuildingEntity();
        building.setLongName("Henry F. Hall Building");
        building.setShortCode("H");
        building.setAddress("1455 De Maisonneuve Blvd. W.");
        building.setCampus("SGW");
        // buildingId is auto-generated, usually starts at 1
        buildingJpaRepository.save(building);
    }

    // Test to ensure that the backend is compliant with expected behaviour in response to a building info retrieval
    @Test
    void testGetBuilding_Returns200() {
        // Retrieve the building to get the generated ID, as IDENTITY strategy typically doesn't reset on deleteAll()
        BuildingEntity savedBuilding = buildingJpaRepository.findAll().get(0);
        Long id = savedBuilding.getBuildingId();

        /* System test: 
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status response forcibly as a Java String
         * ResponseEntity contains: 
         *      The Status Code (e.g., 200 OK, 404 Not Found), 
         *      The Headers (e.g., Content-Type: application/json),
         *      The Body The actual data, stored as a String.
         */ 
        ResponseEntity<String> response = restTemplate.getForEntity("/api/buildings/" + id, String.class);

        // Asserting the software requirement that we should be able to fetch a valid building from the backend
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    // Test to check the system's ability to handle "Negative Scenarios" gracefully
    @Test
    void testGetBuilding_Returns404() {

        /* System test: 
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status response forcibly as a Java String
         * ResponseEntity contains: 
         *      The Status Code (e.g., 200 OK, 404 Not Found), 
         *      The Headers (e.g., Content-Type: application/json),
         *      The Body The actual data, stored as a String.
         */ 
        ResponseEntity<String> response = restTemplate.getForEntity("/api/buildings/9999", String.class);

        // Asserting the software requirement that if we fetch an invalid building from the backend a 404 error is returned
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    // Test to check the backend-api's health endpoint is working as expected
    @Test
    void testHealthEndpoint_Returns200() {

        /* System test: 
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status response forcibly as a Java String
         * ResponseEntity contains: 
         *      The Status Code (e.g., 200 OK, 404 Not Found), 
         *      The Headers (e.g., Content-Type: application/json),
         *      The Body The actual data, stored as a String.
         */ 
        ResponseEntity<String> response = restTemplate.getForEntity("/api/health", String.class);

        // Asserting the software requirement that the health endpoint should be working and return a 200 OK status code
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    // Test to check the backend-api's health endpoint is working as expected when the database connection fails
    @Test
    void testHealthEndpoint_Returns503() {
        /* 
         * Simulate database connection failure using a Spy.
         * We mock the execute command to throw an exception, simulating a crash.
         */ 
        doThrow(new RuntimeException("Simulated DB Connection Down"))
            .when(jdbcTemplate).execute(anyString());

        ResponseEntity<String> response = restTemplate.getForEntity("/api/health", String.class);

        // Asserting the software requirement that if the database connection fails, the health endpoint should return a 503 Service Unavailable status code
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
    }
}
