package com.makesoft.app.api.dto;

public record BuildingResponseDTO(
        Long id,
        String name,
        String code,
        String address,
        String campus,
        boolean hasElevator,
        boolean hasAccessibility,
        boolean hasMetroAccess) {
}
