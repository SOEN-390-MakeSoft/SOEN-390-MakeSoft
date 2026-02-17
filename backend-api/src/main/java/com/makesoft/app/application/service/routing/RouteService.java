package com.makesoft.app.application.service.routing;

import com.makesoft.app.api.routing.RouteResponse;

import java.util.List;

public interface RouteService {
    List<RouteResponse> getRoutes(double originLat, double originLng,
            double destLat, double destLng,
            List<String> modes);
}
