package com.makesoft.app.application.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when a Building with the requested id is not found.
 */
@ResponseStatus(HttpStatus.NOT_FOUND)
public class BuildingNotFoundException extends RuntimeException {
    private final Long buildingId;

    public BuildingNotFoundException(Long buildingId) {
        super("Building not found with id: " + buildingId);
        this.buildingId = buildingId;
    }

    public BuildingNotFoundException(Long buildingId, String message) {
        super(message);
        this.buildingId = buildingId;
    }

    public BuildingNotFoundException(Long buildingId, String message, Throwable cause) {
        super(message, cause);
        this.buildingId = buildingId;
    }

    public Long getBuildingId() {
        return buildingId;
    }
}
