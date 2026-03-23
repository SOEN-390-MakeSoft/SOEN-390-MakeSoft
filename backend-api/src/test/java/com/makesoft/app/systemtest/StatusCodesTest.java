package com.makesoft.app.systemtest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.makesoft.app.infrastructure.persistence.entity.BuildingEntity;
import com.makesoft.app.infrastructure.persistence.springdata.BuildingJpaRepository;

/*
 * This class is for System tests related to API calls and expected responses based on the requirements expected
 * in this project. This specifically tests the behaviour of the entry point, this IS NOT testing the code itself,
 * just checks if the entire backend system is behaving as expected.
*/
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class StatusCodesTest {

    @Autowired
    private MockMvc mockMvc;

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
    void testGetBuilding_Returns200() throws Exception {
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
        mockMvc.perform(get("/api/buildings/" + id))
                .andExpect(status().isOk());
    }

    // Test to check the system's ability to handle "Negative Scenarios" gracefully
    @Test
    void testGetBuilding_Returns404() throws Exception {

        /* System test: 
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status response forcibly as a Java String
         * ResponseEntity contains: 
         *      The Status Code (e.g., 200 OK, 404 Not Found), 
         *      The Headers (e.g., Content-Type: application/json),
         *      The Body The actual data, stored as a String.
         */ 
        mockMvc.perform(get("/api/buildings/9999"))
                .andExpect(status().isNotFound());
    }

    // Test to check the backend-api's health endpoint is working as expected
    @Test
    void testHealthEndpoint_Returns200() throws Exception {

        /* System test: 
         * Send a real HTTP request to the black box setup by SpringBootTest and store the status response forcibly as a Java String
         * ResponseEntity contains: 
         *      The Status Code (e.g., 200 OK, 404 Not Found), 
         *      The Headers (e.g., Content-Type: application/json),
         *      The Body The actual data, stored as a String.
         */ 
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk());
    }

    // Test to check the backend-api's health endpoint is working as expected when the database connection fails
    @Test
    void testHealthEndpoint_Returns503() throws Exception {
        /* 
         * Simulate database connection failure using a Spy.
         * We mock the execute command to throw an exception, simulating a crash.
         */ 
        doThrow(new RuntimeException("Simulated DB Connection Down"))
            .when(jdbcTemplate).execute(anyString());

        mockMvc.perform(get("/api/health"))
                .andExpect(status().isServiceUnavailable());
    }
}
