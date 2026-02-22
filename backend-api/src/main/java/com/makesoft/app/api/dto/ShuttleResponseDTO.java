package com.makesoft.app.api.dto;

import java.time.LocalDateTime;
import java.util.List;

public class ShuttleResponseDTO {

    public static final int TRIP_DURATION = 30;
    private List<LocalDateTime> threeNextShuttles;

    public ShuttleResponseDTO() {
    }

    public ShuttleResponseDTO(List<LocalDateTime> threeNextShuttles) {
        this.threeNextShuttles = threeNextShuttles;
    }

    public List<LocalDateTime> getThreeNextShuttles() {
        return threeNextShuttles;
    }

    public void setThreeNextShuttles(List<LocalDateTime> threeNextShuttles) {
        this.threeNextShuttles = threeNextShuttles;
    }

    public int getTripDuration() {
        return TRIP_DURATION;
    }
}
