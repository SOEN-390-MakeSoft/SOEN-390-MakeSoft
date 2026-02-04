package com.makesoft.app.api.mapper;

import com.makesoft.app.api.dto.BuildingResponseDTO;
import com.makesoft.app.domain.model.building.Building;
import org.springframework.stereotype.Component;

@Component
public class BuildingResponseMapper {
    public BuildingResponseDTO toResponse(Building building) {
        var f = building.getBuildingFeatures();
        return new BuildingResponseDTO(
                building.getBuildingId().value(),
                building.getName(),
                building.getCode(),
                building.getAddress(),
                building.getCampus(),
                f != null && f.isHasElevator(),
                f != null && f.isHasAccessibility(),
                f != null && f.isHasMetroAccess()
        );
    }
}
