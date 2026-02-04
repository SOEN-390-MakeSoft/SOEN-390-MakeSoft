package com.makesoft.app.api.mapper;

import com.makesoft.app.api.dto.BuildingInfoResponse;
import com.makesoft.app.domain.model.building.Building;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class BuildingInfoResponseMapper {
    public BuildingInfoResponse toResponse(Building building) {
        var f = building.getBuildingFeatures();
        return new BuildingInfoResponse(
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
