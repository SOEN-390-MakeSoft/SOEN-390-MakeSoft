package com.makesoft.app.infrastructure.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "building")
public class BuildingEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "building_id", nullable = false)
    private Long buildingId;

    @Column(name = "long_name", nullable = false, unique = true, length = 100)
    private String longName;

    @Column(name = "short_code", length = 10)
    private String shortCode;

    @Column(name = "address", length = 255)
    private String address;

    @Column(name = "campus", length = 10)
    private String campus;

    @Column(name = "has_elevator", nullable = false)
    private boolean hasElevator = false;

    @Column(name = "has_accessibility", nullable = false)
    private boolean hasAccessibility = false;

    @Column(name = "has_metro_access", nullable = false)
    private boolean hasMetroAccess = false;

    // JPA requires a no-arg constructor
    protected BuildingEntity() {}

    public Long getBuildingId() {
        return buildingId;
    }

    public void setBuildingId(Long buildingId) {
        this.buildingId = buildingId;
    }

    public String getLongName() {
        return longName;
    }

    public void setLongName(String longName) {
        this.longName = longName;
    }

    public String getShortCode() {
        return shortCode;
    }

    public void setShortCode(String shortCode) {
        this.shortCode = shortCode;
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
