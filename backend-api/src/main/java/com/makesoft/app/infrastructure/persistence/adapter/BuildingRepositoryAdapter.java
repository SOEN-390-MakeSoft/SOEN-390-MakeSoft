package com.makesoft.app.infrastructure.persistence.adapter;

import com.makesoft.app.application.port.BuildingRepository;
import com.makesoft.app.domain.model.building.Building;
import com.makesoft.app.domain.model.building.BuildingId;
import com.makesoft.app.infrastructure.persistence.mapper.BuildingMapper;
import com.makesoft.app.infrastructure.persistence.springdata.BuildingJpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class BuildingRepositoryAdapter implements BuildingRepository {
    private final BuildingJpaRepository buildingJpaRepository;
    private final BuildingMapper buildingMapper;

    public BuildingRepositoryAdapter(BuildingJpaRepository buildingJpaRepository, BuildingMapper buildingMapper) {
        this.buildingJpaRepository = buildingJpaRepository;
        this.buildingMapper = buildingMapper;
    }

    @Override
    public Optional<Building> findById(BuildingId buildingId) {
        if (buildingId == null) return Optional.empty();
        return buildingJpaRepository.findById(buildingId.value())
                .map(buildingMapper::toDomain);
    }


}
