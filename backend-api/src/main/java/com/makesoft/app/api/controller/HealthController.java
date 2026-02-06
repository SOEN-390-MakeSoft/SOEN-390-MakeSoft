package com.makesoft.app.api.controller;

import org.slf4j.Logger;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthController {
    private final Logger logger = org.slf4j.LoggerFactory.getLogger(HealthController.class);

    @GetMapping("/health")
    public Map<String, String> health() {
        logger.debug("Health check endpoint called");

        Map<String, String> response = new HashMap<>();
        response.put("status", "Backend is running");
        response.put("timestamp", LocalDateTime.now().toString());

        logger.debug("Health check response: {}", response);

        return response;
    }
}
