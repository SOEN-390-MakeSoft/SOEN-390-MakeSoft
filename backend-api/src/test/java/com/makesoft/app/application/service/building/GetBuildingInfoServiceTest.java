package com.makesoft.app.application.service.building;

import com.makesoft.app.application.exception.BuildingNotFoundException;
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

    /**
     * Test GetBuildingInfoService.getById when building is found by repository.
     * Should return a Building domain object.
     */
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

    /**
     * Test GetBuildingInfoService.getById when building is not found by repository.
     * Should throw a BuildingNotFoundException.
     */
    @Test
    void getByIdTest_WhenBuildingIsNotFound() {
        when(buildingRepository.findById(any(BuildingId.class))).thenReturn(Optional.empty());

        BuildingNotFoundException exception = assertThrows(BuildingNotFoundException.class, () -> service.getById(999L));
        assertThat(exception.getBuildingId()).isEqualTo(999L);
        assertThat(exception.getMessage()).contains("Building not found with id: 999");
    }
}
