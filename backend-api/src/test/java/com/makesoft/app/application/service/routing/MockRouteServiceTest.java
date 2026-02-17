package com.makesoft.app.application.service.routing;

import com.makesoft.app.api.routing.RouteResponse;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MockRouteServiceTest {

    @Test
    void mapsAliasModesToCanonicalModes() {
        MockRouteService service = new MockRouteService();

        List<RouteResponse> routes = service.getRoutes(
                45.4973, -73.5789,
                45.4940, -73.5800,
                List.of("car", "walk", "shuttle")
        );

        Map<String, RouteResponse> byMode = routes.stream()
                .collect(Collectors.toMap(RouteResponse::mode, r -> r));

        assertTrue(byMode.containsKey("driving"));
        assertTrue(byMode.containsKey("walking"));
        assertTrue(byMode.containsKey("transit"));
    }

    @Test
    void drivingIsFasterThanWalking() {
        MockRouteService service = new MockRouteService();

        List<RouteResponse> routes = service.getRoutes(
                45.4973, -73.5789,
                45.4940, -73.5800,
                List.of("driving", "walking")
        );

        Map<String, RouteResponse> byMode = routes.stream()
                .collect(Collectors.toMap(RouteResponse::mode, r -> r));

        RouteResponse driving = byMode.get("driving");
        RouteResponse walking = byMode.get("walking");

        assertNotNull(driving);
        assertNotNull(walking);
        assertTrue(driving.durationSeconds() < walking.durationSeconds());
    }
}
