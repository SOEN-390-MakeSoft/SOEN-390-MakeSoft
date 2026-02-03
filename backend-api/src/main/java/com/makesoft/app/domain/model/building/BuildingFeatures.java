package com.makesoft.app.domain.model.building;

public class BuildingFeatures {
    private boolean hasElevator;
    private boolean hasAccessibility;
    private boolean hasMetroAccess;

    public BuildingFeatures(boolean hasElevator, boolean hasAccessibility, boolean hasMetroAccess) {
        this.hasElevator = hasElevator;
        this.hasAccessibility = hasAccessibility;
        this.hasMetroAccess = hasMetroAccess;
    }

    public boolean isHasElevator() {
        return hasElevator;
    }

    public void setHasElevator(boolean hasElevator) {
        this.hasElevator = hasElevator;
    }

    public boolean isHasAccessibility() {
        return hasAccessibility;
    }

    public void setHasAccessibility(boolean hasAccessibility) {
        this.hasAccessibility = hasAccessibility;
    }

    public boolean isHasMetroAccess() {
        return hasMetroAccess;
    }

    public void setHasMetroAccess(boolean hasMetroAccess) {
        this.hasMetroAccess = hasMetroAccess;
    }
}
