package com.makesoft.app.api.controller;

import com.makesoft.app.api.dto.BuildingResponseDTO;
import com.makesoft.app.api.mapper.BuildingResponseMapper;
import com.makesoft.app.application.service.building.GetBuildingInfoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("api/buildings")
public class BuildingController {
    private static final Logger logger = LoggerFactory.getLogger(BuildingController.class);

    private final GetBuildingInfoService getBuildingInfoService;
    private final BuildingResponseMapper buildingResponseMapper;

    public BuildingController(GetBuildingInfoService getBuildingInfoService,
                              BuildingResponseMapper buildingResponseMapper) {
        this.getBuildingInfoService = getBuildingInfoService;
        this.buildingResponseMapper = buildingResponseMapper;
    }

    @GetMapping("/{id}")
    public ResponseEntity<BuildingResponseDTO> getBuildingById(@PathVariable("id") Long id) {
        logger.info("Endpoint called | GET /api/buildings/{}", id);

        var building = getBuildingInfoService.getById(id);
        return ResponseEntity.ok(buildingResponseMapper.toResponse(building));
    }

}
