package com.makesoft.app.api.routing;

import com.makesoft.app.application.service.routing.RouteService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/routes")
public class RouteController {

    private final RouteService routeService;

    public RouteController(RouteService routeService) {
        this.routeService = routeService;
    }

    @GetMapping
    public ResponseEntity<List<RouteResponse>> getRoutes(
            @RequestParam double originLat,
            @RequestParam double originLng,
            @RequestParam double destLat,
            @RequestParam double destLng,
            @RequestParam(required = false, defaultValue = "all") String mode) {
        List<String> modes;
        if (mode == null || mode.isBlank() || "all".equalsIgnoreCase(mode)) {
            modes = List.of("driving", "walking", "transit");
        } else {
            modes = Arrays.stream(mode.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toList());
        }

        var routes = routeService.getRoutes(originLat, originLng, destLat, destLng, modes);
        return ResponseEntity.ok(routes);
    }
}
