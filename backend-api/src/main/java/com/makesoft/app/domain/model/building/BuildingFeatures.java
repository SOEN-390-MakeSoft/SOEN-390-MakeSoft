package com.makesoft.app.domain.model.building;

public class BuildingFeatures {
    private final boolean hasElevator;
    private final boolean hasAccessibility;
    private final boolean hasMetroAccess;

    public BuildingFeatures(boolean hasElevator, boolean hasAccessibility, boolean hasMetroAccess) {
        this.hasElevator = hasElevator;
        this.hasAccessibility = hasAccessibility;
        this.hasMetroAccess = hasMetroAccess;
    }

    public boolean isHasElevator() {
        return hasElevator;
    }

    public boolean isHasAccessibility() {
        return hasAccessibility;
    }

    public boolean isHasMetroAccess() {
        return hasMetroAccess;
    }
}
