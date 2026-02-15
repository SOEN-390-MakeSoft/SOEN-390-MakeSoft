package com.makesoft.app.application.service.shuttle;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

class GetNextShuttleServiceTest {

    private GetNextShuttleService service;

    @BeforeEach
    void setUp() {
        service = new GetNextShuttleService();
    }

    @Test
    void findNextShuttle_ReturnsExactly3Elements() {
        // Test that the service always returns exactly 3 elements
        List<LocalDateTime> result = service.findNextShuttle("SGW", 0, null);

        assertNotNull(result);
        assertThat(result).hasSize(3);
    }

    @Test
    void findNextShuttle_BothCampuses_ReturnsValidData() {
        // Test both SGW and LOY campuses
        List<LocalDateTime> sgwResult = service.findNextShuttle("SGW", 0, null);
        List<LocalDateTime> loyResult = service.findNextShuttle("LOY", 0, null);

        assertThat(sgwResult).hasSize(3);
        assertThat(loyResult).hasSize(3);
    }

    @Test
    void findNextShuttle_WithOffset_ReturnsAdjustedShuttles() {
        // Test with 10 minutes offset
        List<LocalDateTime> result = service.findNextShuttle("SGW", 10, null);

        assertNotNull(result);
        assertThat(result).hasSize(3);

        // Verify that any non-null shuttle is in the future (after current time + 10 minutes)
        LocalDateTime adjustedTime = LocalDateTime.now().plusMinutes(10);
        for (LocalDateTime shuttle : result) {
            if (shuttle != null) {
                assertThat(shuttle).isAfter(adjustedTime);
            }
        }
    }

    //  Tests with actual schedule times

    @Test
    void findNextShuttle_MondayMorning_SGW_ReturnsActualTimes() {
        // Monday at 9:00 AM - next shuttles should be 9:30, 9:45, 10:00
        LocalDateTime referenceTime = LocalDateTime.of(2026, 2, 16, 9, 0);
        List<LocalDateTime> result = service.findNextShuttle("SGW", 0, referenceTime);

        assertThat(result).hasSize(3);
        assertThat(result.get(0)).isNotNull();
        assertThat(result.get(0).toLocalTime()).isEqualTo(LocalTime.of(9, 30));
        assertThat(result.get(1)).isNotNull();
        assertThat(result.get(1).toLocalTime()).isEqualTo(LocalTime.of(9, 45));
        assertThat(result.get(2)).isNotNull();
        assertThat(result.get(2).toLocalTime()).isEqualTo(LocalTime.of(10, 0));
    }

    @Test
    void findNextShuttle_MondayMorning_LOY_ReturnsActualTimes() {
        // Monday at 9:00 AM - next shuttles from LOY should be 9:15, 9:30, 9:45
        LocalDateTime referenceTime = LocalDateTime.of(2026, 2, 16, 9, 0);
        List<LocalDateTime> result = service.findNextShuttle("LOY", 0, referenceTime);

        assertThat(result).hasSize(3);
        assertThat(result.get(0)).isNotNull();
        assertThat(result.get(0).toLocalTime()).isEqualTo(LocalTime.of(9, 15));
        assertThat(result.get(1)).isNotNull();
        assertThat(result.get(1).toLocalTime()).isEqualTo(LocalTime.of(9, 30));
        assertThat(result.get(2)).isNotNull();
        assertThat(result.get(2).toLocalTime()).isEqualTo(LocalTime.of(9, 45));
    }

    @Test
    void findNextShuttle_WednesdayAfternoon_SGW_ReturnsActualTimes() {
        // Wednesday at 1:00 PM - next shuttles should be 13:15, 13:30, 13:45
        LocalDateTime referenceTime = LocalDateTime.of(2026, 2, 18, 13, 0);
        List<LocalDateTime> result = service.findNextShuttle("SGW", 0, referenceTime);

        assertThat(result).hasSize(3);
        assertThat(result.get(0)).isNotNull();
        assertThat(result.get(0).toLocalTime()).isEqualTo(LocalTime.of(13, 15));
        assertThat(result.get(1)).isNotNull();
        assertThat(result.get(1).toLocalTime()).isEqualTo(LocalTime.of(13, 30));
        assertThat(result.get(2)).isNotNull();
        assertThat(result.get(2).toLocalTime()).isEqualTo(LocalTime.of(13, 45));
    }

    @Test
    void findNextShuttle_ThursdayWithOffset_LOY_ReturnsActualTimes() {
        // Thursday at 2:30 PM with 10 min offset (adjusted to 2:40 PM)
        // Next shuttles should be 14:45, 15:00, 15:15
        LocalDateTime referenceTime = LocalDateTime.of(2026, 2, 19, 14, 30);
        List<LocalDateTime> result = service.findNextShuttle("LOY", 10, referenceTime);

        assertThat(result).hasSize(3);
        assertThat(result.get(0)).isNotNull();
        assertThat(result.get(0).toLocalTime()).isEqualTo(LocalTime.of(14, 45));
        assertThat(result.get(1)).isNotNull();
        assertThat(result.get(1).toLocalTime()).isEqualTo(LocalTime.of(15, 0));
        assertThat(result.get(2)).isNotNull();
        assertThat(result.get(2).toLocalTime()).isEqualTo(LocalTime.of(15, 15));
    }

    @Test
    void findNextShuttle_FridayMorning_SGW_ReturnsActualTimes() {
        // Friday at 9:30 AM - next shuttles should be 9:45, 10:00, 10:15
        LocalDateTime referenceTime = LocalDateTime.of(2026, 2, 20, 9, 30);
        List<LocalDateTime> result = service.findNextShuttle("SGW", 0, referenceTime);

        assertThat(result).hasSize(3);
        assertThat(result.get(0)).isNotNull();
        assertThat(result.get(0).toLocalTime()).isEqualTo(LocalTime.of(9, 45));
        assertThat(result.get(1)).isNotNull();
        assertThat(result.get(1).toLocalTime()).isEqualTo(LocalTime.of(10, 0));
        assertThat(result.get(2)).isNotNull();
        assertThat(result.get(2).toLocalTime()).isEqualTo(LocalTime.of(10, 15));
    }

    @Test
    void findNextShuttle_FridayAfternoon_LOY_ReturnsActualTimes() {
        // Friday at 3:00 PM - next shuttles should be 15:15, 15:30, 15:45
        LocalDateTime referenceTime = LocalDateTime.of(2026, 2, 20, 15, 0);
        List<LocalDateTime> result = service.findNextShuttle("LOY", 0, referenceTime);

        assertThat(result).hasSize(3);
        assertThat(result.get(0)).isNotNull();
        assertThat(result.get(0).toLocalTime()).isEqualTo(LocalTime.of(15, 15));
        assertThat(result.get(1)).isNotNull();
        assertThat(result.get(1).toLocalTime()).isEqualTo(LocalTime.of(15, 30));
        assertThat(result.get(2)).isNotNull();
        assertThat(result.get(2).toLocalTime()).isEqualTo(LocalTime.of(15, 45));
    }

    // test with offset
    @Test
    void findNextShuttle_WednesdayWithOffset_LOY_ReturnsActualTimes() {
        // Wednesday at 10:00 AM with 20 min offset (adjusted to 10:20 AM)
        // Next shuttles should be 10:30, 10:45, 11:00
        LocalDateTime referenceTime = LocalDateTime.of(2026, 2, 18, 10, 0);
        List<LocalDateTime> result = service.findNextShuttle("LOY", 20, referenceTime);

        assertThat(result).hasSize(3);
        assertThat(result.get(0)).isNotNull();
        assertThat(result.get(0).toLocalTime()).isEqualTo(LocalTime.of(10, 30));
        assertThat(result.get(1)).isNotNull();
        assertThat(result.get(1).toLocalTime()).isEqualTo(LocalTime.of(10, 45));
        assertThat(result.get(2)).isNotNull();
        assertThat(result.get(2).toLocalTime()).isEqualTo(LocalTime.of(11, 0));
    }

    @Test
    void findNextShuttle_FridayEndOfDay_SGW_ReturnsFewerShuttles() {
        // Friday at 6:00 PM where  last shuttle is at 18:15, so only 1 is available, two others should be null
        LocalDateTime referenceTime = LocalDateTime.of(2026, 2, 20, 18, 0);
        List<LocalDateTime> result = service.findNextShuttle("SGW", 0, referenceTime);

        assertThat(result).hasSize(3);
        assertThat(result.get(0)).isNotNull();
        assertThat(result.get(0).toLocalTime()).isEqualTo(LocalTime.of(18, 15));
        assertThat(result.get(1)).isNull();
        assertThat(result.get(2)).isNull();
    }

    @Test
    void findNextShuttle_MondayEndOfDay_LOY_ReturnsFewerShuttles() {
        // Monday at 6:10 PM - last shuttles are 18:15, 18:30, so only 2 available
        LocalDateTime referenceTime = LocalDateTime.of(2026, 2, 16, 18, 10);
        List<LocalDateTime> result = service.findNextShuttle("LOY", 0, referenceTime);

        assertThat(result).hasSize(3);
        assertThat(result.get(0)).isNotNull();
        assertThat(result.get(0).toLocalTime()).isEqualTo(LocalTime.of(18, 15));
        assertThat(result.get(1)).isNotNull();
        assertThat(result.get(1).toLocalTime()).isEqualTo(LocalTime.of(18, 30));
        assertThat(result.get(2)).isNull();
    }

    @Test
    void findNextShuttle_Weekend_ReturnsAllNulls() {
        // All weekends should return null
        // Saturday at 10:00 AM
        LocalDateTime saturday = LocalDateTime.of(2026, 2, 21, 10, 0);
        List<LocalDateTime> satResult = service.findNextShuttle("SGW", 0, saturday);

        // Sunday at 3:00 PM
        LocalDateTime sunday = LocalDateTime.of(2026, 2, 22, 15, 0);
        List<LocalDateTime> sunResult = service.findNextShuttle("LOY", 0, sunday);

        assertThat(satResult).containsExactly(null, null, null);
        assertThat(sunResult).containsExactly(null, null, null);
    }


}
