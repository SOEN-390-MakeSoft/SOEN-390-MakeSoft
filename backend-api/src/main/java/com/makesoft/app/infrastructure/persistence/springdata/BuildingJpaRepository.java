package com.makesoft.app.infrastructure.persistence.springdata;

import com.makesoft.app.infrastructure.persistence.entity.BuildingEntity;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

@Repository
public interface BuildingJpaRepository extends JpaRepository<BuildingEntity, Long> {
    Optional<BuildingEntity> findByBuildingId(Long buildingId);
}
