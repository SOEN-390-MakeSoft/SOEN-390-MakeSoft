package com.makesoft.app.domain.model.building;

public class Building {
    private final BuildingId buildingId;
    private final String name;
    private final String code;
    private final String address;
    private final String campus;
    private final BuildingFeatures buildingFeatures;

    public Building(BuildingId buildingId, String name, String code, String address, String campus,
                    BuildingFeatures buildingFeatures) {
        this.buildingId = buildingId;
        this.name = name;
        this.code = code;
        this.address = address;
        this.campus = campus;
        this.buildingFeatures = buildingFeatures;
    }

    public BuildingId getBuildingId() {
        return buildingId;
    }

    public String getName() {
        return name;
    }

    public String getCode() {
        return code;
    }

    public String getAddress() {
        return address;
    }

    public String getCampus() {
        return campus;
    }

    public BuildingFeatures getBuildingFeatures() {
        return buildingFeatures;
    }
}
