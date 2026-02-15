package com.makesoft.app.api.controller;

import com.makesoft.app.api.dto.ShuttleResponseDTO;
import com.makesoft.app.application.service.shuttle.GetNextShuttleService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/shuttle")
public class ShuttleController {
    private static final Logger logger = LoggerFactory.getLogger(ShuttleController.class);

    private final GetNextShuttleService getNextShuttleService;

    public ShuttleController(GetNextShuttleService getNextShuttleService) {
        this.getNextShuttleService = getNextShuttleService;
    }

    @GetMapping("/next")
    public ResponseEntity<ShuttleResponseDTO> getNextShuttles(
            @RequestParam String departureCampus,
            @RequestParam(defaultValue = "0") int offMinutes) {

        // Validate campus parameter
        if (!departureCampus.equals("SGW") && !departureCampus.equals("LOY")) {
            logger.warn("Invalid departureCampus: {}", departureCampus);
            return ResponseEntity.badRequest().build();
        }

        // Validate offMinutes parameter
        if (offMinutes < 0) {
            logger.warn("Invalid offMinutes: {}", offMinutes);
            return ResponseEntity.badRequest().build();
        }



        List<LocalDateTime> nextShuttles = getNextShuttleService.findNextShuttle(departureCampus, offMinutes);
        // trip duration is returned in the response:  do response.getTripDuration(). the trip duration is 30 minutes always so its a constant
        ShuttleResponseDTO response = new ShuttleResponseDTO(nextShuttles);

        return ResponseEntity.ok(response);
    }
}
