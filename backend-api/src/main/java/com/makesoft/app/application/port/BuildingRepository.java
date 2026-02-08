package com.makesoft.app.application.port;

import com.makesoft.app.domain.model.building.Building;
import com.makesoft.app.domain.model.building.BuildingId;

import java.util.Optional;

public interface BuildingRepository {
    Optional<Building> findById(BuildingId buildingId);
}
