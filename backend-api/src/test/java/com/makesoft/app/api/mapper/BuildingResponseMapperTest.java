package com.makesoft.app.api.mapper;

import com.makesoft.app.api.dto.BuildingResponseDTO;
import com.makesoft.app.domain.model.building.Building;
import com.makesoft.app.domain.model.building.BuildingFeatures;
import com.makesoft.app.domain.model.building.BuildingId;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BuildingResponseMapperTest {

    private final BuildingResponseMapper mapper = new BuildingResponseMapper();

    /**
     * Test BuildingResponseMapper.toResponse with BuildingFeatures.
     * Should return a BuildingResponseDTO with features correctly mapped.
     */
    @Test
    void toResponseTest_WithBuildingFeatures() {
        var features = new BuildingFeatures(true, false, true);
        var building = new Building(new BuildingId(1L), "Henry F. Hall Building",
                "H", "1455 De Maisonneuve Blvd. W.", "SGW", features);

        BuildingResponseDTO dto = mapper.toResponse(building);

        assertThat(dto).isNotNull();
        assertThat(dto.id()).isEqualTo(1L);
        assertThat(dto.name()).isEqualTo("Henry F. Hall Building");
        assertThat(dto.code()).isEqualTo("H");
        assertThat(dto.address()).isEqualTo("1455 De Maisonneuve Blvd. W.");
        assertThat(dto.campus()).isEqualTo("SGW");
        assertThat(dto.hasElevator()).isTrue();
        assertThat(dto.hasAccessibility()).isFalse();
        assertThat(dto.hasMetroAccess()).isTrue();
    }

    /**
     * Test BuildingResponseMapper.toResponse when BuildingFeatures is null.
     * Should return a BuildingResponseDTO with features set to false.
     */
    @Test
    void toResponseTest_WithNullBuildingFeatures() {
        var building = new Building(new BuildingId(11L), "No Feature Building",
                "NF", "Unknown", "SGW", null);

        BuildingResponseDTO dto = mapper.toResponse(building);

        assertThat(dto).isNotNull();
        assertThat(dto.id()).isEqualTo(11L);
        assertThat(dto.name()).isEqualTo("No Feature Building");
        assertThat(dto.hasElevator()).isFalse();
        assertThat(dto.hasAccessibility()).isFalse();
        assertThat(dto.hasMetroAccess()).isFalse();
    }
}
