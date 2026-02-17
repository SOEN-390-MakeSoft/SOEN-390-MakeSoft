package com.makesoft.app.api.routing;

import java.time.Instant;

/**
 * DTO for routing responses.
 */
public record RouteResponse(
        String mode,
        long durationSeconds,
        double distanceMeters,
        Instant eta,
        String summary,
        String polyline) {
}
