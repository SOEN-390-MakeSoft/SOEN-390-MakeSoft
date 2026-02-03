package com.makesoft.app.domain.model.building;

public class Building {
    private final BuildingId buildingId;
    private String name;
    private String code;
    private String address;
    private String campus;
    private BuildingFeatures buildingFeatures;

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

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getCampus() {
        return campus;
    }

    public void setCampus(String campus) {
        this.campus = campus;
    }

    public BuildingFeatures getBuildingFeatures() {
        return buildingFeatures;
    }

    public void setBuildingFeatures(BuildingFeatures buildingFeatures) {
        this.buildingFeatures = buildingFeatures;
    }
}
