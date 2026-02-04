package com.makesoft.app.infrastructure.persistence.entity;

public class BuildingEntityBuilder {

    private Long buildingId = null;
    private String longName = "Hall Building";
    private String shortCode = "H";
    private String address = "1455 De Maisonneuve Blvd W";
    private String campus = "SGW";
    private boolean hasElevator = true;
    private boolean hasAccessibility = true;
    private boolean hasMetroAccess = false;

    private BuildingEntityBuilder() {
    }

    public static BuildingEntityBuilder aBuilding() {
        return new BuildingEntityBuilder();
    }

    public BuildingEntityBuilder withId(Long id) {
        this.buildingId = id;
        return this;
    }

    public BuildingEntityBuilder withLongName(String longName) {
        this.longName = longName;
        return this;
    }

    public BuildingEntityBuilder withShortCode(String shortCode) {
        this.shortCode = shortCode;
        return this;
    }

    public BuildingEntityBuilder withAddress(String address) {
        this.address = address;
        return this;
    }

    public BuildingEntityBuilder withCampus(String campus) {
        this.campus = campus;
        return this;
    }

    public BuildingEntityBuilder withHasElevator(boolean value) {
        this.hasElevator = value;
        return this;
    }

    public BuildingEntityBuilder withHasAccessibility(boolean value) {
        this.hasAccessibility = value;
        return this;
    }

    public BuildingEntityBuilder withHasMetroAccess(boolean value) {
        this.hasMetroAccess = value;
        return this;
    }

    public BuildingEntity build() {
        BuildingEntity e = new BuildingEntity();
        e.setBuildingId(buildingId);
        e.setLongName(longName);
        e.setShortCode(shortCode);
        e.setAddress(address);
        e.setCampus(campus);
        e.setHasElevator(hasElevator);
        e.setHasAccessibility(hasAccessibility);
        e.setHasMetroAccess(hasMetroAccess);
        return e;
    }
}
