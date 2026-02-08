package com.makesoft.app.systemtest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.makesoft.app.api.dto.BuildingResponseDTO;
import com.makesoft.app.infrastructure.persistence.entity.BuildingEntity;
import com.makesoft.app.infrastructure.persistence.springdata.BuildingJpaRepository;


/*
 * This class tests the integrity of the data being sent from the backend API, ensuring that the 
 * entire pipeline (SQL Query -> JPA Mapping -> DTO Conversion -> JSON Serialization) is working 
 * perfectly without altering any data. This is a black-box system test that verifies the correctness 
 * of the data returned by the API endpoint, ensuring that it matches the expected values based on the 
 * database entries.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public class DataIntegrityTest {
    
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
        building.setHasElevator(true);
        building.setHasAccessibility(true);
        building.setHasMetroAccess(true);
        // buildingId is auto-generated, usually starts at 1
        buildingJpaRepository.save(building);
    }

    /*
     * Test to verify that the entire building information fetching pipeline is working 
     * perfectly while ensuring that the data integrity is kept.
    */ 
    @Test
    void testGetBuildingInfo_ReturnsCorrectRecord() {
        // Retrieve the building to get the generated ID, as IDENTITY strategy typically doesn't reset on deleteAll()
        BuildingEntity savedBuilding = buildingJpaRepository.findAll().get(0);
        Long id = savedBuilding.getBuildingId();

        /* System test: 
         * Send a real HTTP request to the black box setup by SpringBootTest and store the expected status 
         * response (which in this case is a BuildingResponseDTO object)
         * ResponseEntity contains: 
         *      The Status Code (e.g., 200 OK, 404 Not Found), 
         *      The Headers (e.g., Content-Type: application/json),
         *      The Body The actual data, stored as a BuildingResponseDTO.
         */ 
        ResponseEntity<BuildingResponseDTO> response = restTemplate.getForEntity("/api/buildings/" + id, BuildingResponseDTO.class);

        // Verify request was successful
        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();

        BuildingResponseDTO responseBody = response.getBody();

        // What the "Truth" should look like based on Database/Requirements
        BuildingResponseDTO expectedData = new BuildingResponseDTO(
            id, "Henry F. Hall Building", "H", "1455 De Maisonneuve Blvd. W.", "SGW",
            true,  // hasElevator
            true,  // hasAccessibility
            true  // hasMetroAccess
        );

        /*
         * Asserting the software requirement that when fetching data from the db, the data integrity is kept.
         * Uses AssertJ for field by field JSON data comparison, simpler.
        */
        assertThat(responseBody)
            .usingRecursiveComparison()
            .isEqualTo(expectedData);
    }
    
    /*
     * Test to check the backend-api's health endpoint is working as expected
     * This is important to ensure that the database connection and overall system health is intact before running other tests.
     * It also verifies that the health check endpoint is correctly implemented and returns the expected JSON body.
     */
    @Test
    void testHealthEndpoint_ReturnsCorrectJsonInfo() {

        /* System test: 
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status response forcibly as a Java String
         * ResponseEntity contains: 
         *      The Status Code (e.g., 200 OK, 404 Not Found), 
         *      The Headers (e.g., Content-Type: application/json),
         *      The Body The actual data, stored as a String.
         */ 
        ResponseEntity<String> response = restTemplate.getForEntity("/api/health", String.class);

        // Asserting the software requirement that the health endpoint returns a JSON body containing "status": "UP" and "database": "Connected"
        assertThat(response.getBody())
            .contains("\"status\":\"UP\"")
            .contains("\"database\":\"Connected\"");
    }

    /*
     * Test to check the backend-api's health endpoint is working as expected when the database connection fails
     * This is important to ensure that the health check endpoint correctly identifies and reports database connection issues, \
     * which is crucial for monitoring and alerting in production environments.
    */
    @Test
    void testHealthEndpoint_ReturnsDownWhenDatabaseFails() {

        // Simulate database connection failure by shutting down the in-memory database or by providing incorrect credentials
        // For this test, we can use Mockito to mock the JdbcTemplate and force it to throw an exception when a query is executed, 
        // simulating a database connection failure.    
        doThrow(new RuntimeException("Simulated DB Connection Down"))
            .when(jdbcTemplate).execute(anyString());

        /* System test: 
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status response forcibly as a Java String
         * ResponseEntity contains: 
         *      The Status Code (e.g., 200 OK, 404 Not Found), 
         *      The Headers (e.g., Content-Type: application/json),
         *      The Body The actual data, stored as a String.
         */ 
        ResponseEntity<String> response = restTemplate.getForEntity("/api/health", String.class);

        // Asserting the software requirement that the health endpoint returns a JSON body containing "status": "DOWN" and "reason": "Database connection failed"
        assertThat(response.getBody())
            .contains("\"status\":\"DOWN\"")
            .contains("\"reason\":\"Database connection failed\"");
    }
}
