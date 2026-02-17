package com.makesoft.app.application.service.routing;

import com.makesoft.app.api.routing.RouteResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class MockRouteService implements RouteService {

    @Override
    public List<RouteResponse> getRoutes(double originLat, double originLng, double destLat, double destLng,
            List<String> modes) {
        List<RouteResponse> out = new ArrayList<>();
        double distanceMeters = haversineMeters(originLat, originLng, destLat, destLng);

        for (String mode : modes) {
            String m = mode.toLowerCase();
            double speedMetersPerSec;
            String summary;
            switch (m) {
                case "driving", "car":
                    speedMetersPerSec = 40_000.0 / 3600.0; // 40 km/h
                    summary = "via driving roads";
                    m = "driving";
                    break;
                case "walking", "walk":
                    speedMetersPerSec = 5_000.0 / 3600.0; // 5 km/h
                    summary = "via pedestrian paths";
                    m = "walking";
                    break;
                case "transit", "shuttle":
                    speedMetersPerSec = 25_000.0 / 3600.0; // 25 km/h
                    summary = "via transit";
                    m = "transit";
                    break;
                default:
                    continue;
            }

            long durationSeconds = Math.max(10, Math.round(distanceMeters / speedMetersPerSec));
            Instant eta = Instant.now().plusSeconds(durationSeconds);

            out.add(new RouteResponse(m, durationSeconds, distanceMeters, eta, summary, null));
        }

        return out;
    }

    private static double haversineMeters(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                        * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
