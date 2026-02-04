package com.makesoft.app.application.service.building;

import com.makesoft.app.application.port.BuildingRepository;
import com.makesoft.app.domain.model.building.Building;
import com.makesoft.app.domain.model.building.BuildingId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class GetBuildingInfoService {
    private static final Logger logger = LoggerFactory.getLogger(GetBuildingInfoService.class);

    private final BuildingRepository buildingRepository;

    public GetBuildingInfoService(BuildingRepository buildingRepository) {
        this.buildingRepository = buildingRepository;
    }

    public Building getById(Long id) {
        logger.info("GetBuildingInfoService.getById called with id={}", id);
        Optional<Building> maybe = buildingRepository.findById(new BuildingId(id));

        if (maybe.isEmpty()) {
            logger.info("Building not found for id={}", id);
            throw new RuntimeException("Building not found");
        }

        Building building = maybe.get();
        logger.info("Found building id={} name={}", id, building.getName());

        return building;
    }
}
