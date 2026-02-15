package com.makesoft.app.application.service.shuttle;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Service
public class GetNextShuttleService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Returns exactly 3 shuttle times. If fewer than 3 shuttles available, fills with null.
     * Returns all nulls for weekends (Saturday/Sunday).
     * @param departureCampus The campus to depart from: "SGW" or "LOY"
     * @param offMinutes The number of minutes needed to reach the shuttle departure area
     * @param referenceDateTime Optional reference date/time. If null, uses current time.
     */
    public List<LocalDateTime> findNextShuttle(String departureCampus, int offMinutes, LocalDateTime referenceDateTime) {
        try {
            // Load schedule.json from resources
            InputStream inputStream = getClass().getClassLoader()
                    .getResourceAsStream("shuttle/schedule.json");

            if (inputStream == null) {
                throw new RuntimeException("schedule.json not found");
            }

            JsonNode scheduleRoot = objectMapper.readTree(inputStream);

            // Use provided reference time or current time, then add offset minutes
            LocalDateTime baseTime = (referenceDateTime != null) ? referenceDateTime : LocalDateTime.now();
            LocalDateTime adjustedTime = baseTime.plusMinutes(offMinutes);
            DayOfWeek dayOfWeek = adjustedTime.getDayOfWeek();

            // Return all nulls for weekends
            if (dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY) {
                return Arrays.asList(null, null, null);
            }

            // Determine day type
            String dayType = (dayOfWeek == DayOfWeek.FRIDAY) ? "FRIDAY" : "MON_THU";

            // Get departures for the specified campus and day type
            JsonNode departures = scheduleRoot
                    .path("dayTypes")
                    .path(dayType)
                    .path("departures")
                    .path(departureCampus);

            // Find next shuttles today (after adjusted time)
            LocalTime currentTime = adjustedTime.toLocalTime();
            List<LocalDateTime> nextShuttles = new ArrayList<>();

            for (JsonNode departureNode : departures) {
                String departureTimeStr = departureNode.asText();
                LocalTime departureTime = LocalTime.parse(departureTimeStr, TIME_FORMATTER);

                if (departureTime.isAfter(currentTime)) {
                    nextShuttles.add(LocalDateTime.of(adjustedTime.toLocalDate(), departureTime));

                    // Collect up to 3 shuttles
                    if (nextShuttles.size() == 3) {
                        break;
                    }
                }
            }

            // Fill remaining slots with null to always have 3 values
            while (nextShuttles.size() < 3) {
                nextShuttles.add(null);
            }

            return nextShuttles;

        } catch (IOException e) {
            throw new RuntimeException("Error reading schedule.json", e);
        }
    }


}
