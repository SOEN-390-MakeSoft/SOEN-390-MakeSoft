package com.makesoft.app.application.service.building;

import com.makesoft.app.application.port.BuildingRepository;
import com.makesoft.app.domain.model.building.Building;
import com.makesoft.app.domain.model.building.BuildingFeatures;
import com.makesoft.app.domain.model.building.BuildingId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GetBuildingInfoServiceTest {

    @Mock
    BuildingRepository buildingRepository;

    @InjectMocks
    GetBuildingInfoService service;

    @Test
    void getByIdTest_WhenBuildingIsFound() {
        var building = new Building(new BuildingId(1L), "Name", "C", "Addr", "Campus",
                new BuildingFeatures(true, false, true));
        when(buildingRepository.findById(any(BuildingId.class))).thenReturn(Optional.of(building));

        var result = service.getById(1L);

        assertThat(result).isNotNull();
        assertThat(result.getBuildingId()).isEqualTo(new BuildingId(1L));
        assertThat(result.getName()).isEqualTo("Name");
    }

    @Test
    void getByIdTest_WhenBuildingIsNotFound() {
        // Arrange
        when(buildingRepository.findById(any(BuildingId.class))).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(RuntimeException.class, () -> service.getById(999L));
    }
}
