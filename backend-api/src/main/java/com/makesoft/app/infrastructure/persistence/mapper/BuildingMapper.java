package com.makesoft.app.infrastructure.persistence.mapper;

import com.makesoft.app.domain.model.building.Building;
import com.makesoft.app.domain.model.building.BuildingFeatures;
import com.makesoft.app.domain.model.building.BuildingId;
import com.makesoft.app.infrastructure.persistence.entity.BuildingEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface BuildingMapper {

    @Mapping(source = "buildingId", target = "buildingId")
    @Mapping(source = "longName", target = "name")
    @Mapping(source = "shortCode", target = "code")
    @Mapping(source = ".", target = "buildingFeatures")
    Building toDomain(BuildingEntity entity);

    BuildingFeatures toBuildingFeaturesFromEntity(BuildingEntity entity);

    default BuildingId longToBuildingId(Long id) {
        return id == null ? null : new BuildingId(id);
    }

}
