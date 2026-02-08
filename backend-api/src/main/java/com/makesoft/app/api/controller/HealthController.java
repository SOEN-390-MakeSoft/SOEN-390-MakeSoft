package com.makesoft.app.api.controller;

import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;

/*
 * This controller provides a simple health check endpoint to verify that the backend API is running and can connect to its dependencies (e.g., database).
 * It returns a JSON response with the status of the application and the database connection.
*/

@RestController
@RequestMapping("/api")
public class HealthController {
    private final Logger logger = org.slf4j.LoggerFactory.getLogger(HealthController.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // Endpoint to check the health of the application focusing on database connectivity
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> response = new HashMap<>();
        
        try {
            // Attempt a simple query to Neon (System dependency check)
            jdbcTemplate.execute("SELECT 1"); 
            
            response.put("status", "UP");
            response.put("database", "Connected");
            response.put("timestamp", LocalDateTime.now().toString());
            return ResponseEntity.ok(response); // Returns 200 OK
            
        } catch (Exception e) {
            response.put("status", "DOWN");
            response.put("reason", "Database connection failed");
            response.put("timestamp", LocalDateTime.now().toString());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response); // Returns 503
        }
    }
}
