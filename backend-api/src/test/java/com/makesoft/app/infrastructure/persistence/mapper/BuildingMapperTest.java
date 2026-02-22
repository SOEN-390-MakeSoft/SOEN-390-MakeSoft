package com.makesoft.app.infrastructure.persistence.mapper;

import com.makesoft.app.domain.model.building.Building;
import com.makesoft.app.domain.model.building.BuildingId;
import com.makesoft.app.infrastructure.persistence.entity.BuildingEntity;
import com.makesoft.app.infrastructure.persistence.entity.BuildingEntityBuilder;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

import static org.junit.jupiter.api.Assertions.*;

class BuildingMapperTest {

    private final BuildingMapper mapper = Mappers.getMapper(BuildingMapper.class);

    /**
     * Test BuildingMapper.toDomain with a valid BuildingEntity.
     * Should correctly map the BuildingEntity to a Building domain object.
     */
    @Test
    void toDomainTest_WithValidEntity() {
        BuildingEntityBuilder builder = BuildingEntityBuilder.aBuilding();

        BuildingEntity entity = builder.withId(1L)
               .withLongName("Henry F. Hall Building")
               .withShortCode("H")
               .withAddress("1455 De Maisonneuve Blvd. W.")
               .withCampus("SGW")
               .withHasElevator(true)
               .withHasAccessibility(true)
               .withHasMetroAccess(false)
               .build();

        Building domain = mapper.toDomain(entity);

        assertNotNull(domain);
        assertEquals(new BuildingId(1L), domain.getBuildingId());
        assertEquals("Henry F. Hall Building", domain.getName());
        assertEquals("H", domain.getCode());
        assertEquals("1455 De Maisonneuve Blvd. W.", domain.getAddress());
        assertEquals("SGW", domain.getCampus());

        assertNotNull(domain.getBuildingFeatures());
        assertTrue(domain.getBuildingFeatures().isHasElevator());
        assertTrue(domain.getBuildingFeatures().isHasAccessibility());
        assertFalse(domain.getBuildingFeatures().isHasMetroAccess());
    }

    /**
     * Test BuildingMapper.toDomain when entity is null.
     * Should return a null Building domain object.
     */
    @Test
    void toDomainTest_WithNullEntity() {
        Building domain = mapper.toDomain(null);
        assertNull(domain);
    }
}
