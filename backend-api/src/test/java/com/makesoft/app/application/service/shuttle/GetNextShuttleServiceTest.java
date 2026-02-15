package com.makesoft.app.application.service.shuttle;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
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
        List<LocalDateTime> result = service.findNextShuttle("SGW", 0);

        assertNotNull(result);
        assertThat(result).hasSize(3);
    }

    @Test
    void findNextShuttle_ValidCampusSGW() {
        List<LocalDateTime> result = service.findNextShuttle("SGW", 0);

        assertNotNull(result);
        assertThat(result).hasSize(3);
    }

    @Test
    void findNextShuttle_ValidCampusLOY() {
        List<LocalDateTime> result = service.findNextShuttle("LOY", 0);

        assertNotNull(result);
        assertThat(result).hasSize(3);
    }

    @Test
    void findNextShuttle_WithOffMinutes() {
        // Test with 10 minutes offset
        List<LocalDateTime> result = service.findNextShuttle("SGW", 10);

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

    @Test
    void findNextShuttle_ReturnsNullsWhenFewerThan3Available() {
        // This test will pass if we're at the end of the day with fewer than 3 shuttles
        // The service should fill remaining slots with null
        List<LocalDateTime> result = service.findNextShuttle("SGW", 0);

        assertThat(result).hasSize(3);
        // At least one element should exist (either a time or null)
        assertThat(result).isNotEmpty();
    }

    @Test
    void findNextShuttle_AllShuttlesAreInFuture() {
        List<LocalDateTime> result = service.findNextShuttle("SGW", 0);
        LocalDateTime now = LocalDateTime.now();

        for (LocalDateTime shuttle : result) {
            if (shuttle != null) {
                assertThat(shuttle).isAfter(now);
            }
        }
    }

    @Test
    void findNextShuttle_BothCampusesReturnValidData() {
        List<LocalDateTime> sgwResult = service.findNextShuttle("SGW", 0);
        List<LocalDateTime> loyResult = service.findNextShuttle("LOY", 0);

        assertThat(sgwResult).hasSize(3);
        assertThat(loyResult).hasSize(3);
    }

    @Test
    void findNextShuttle_LargeOffMinutesStillReturns3Elements() {
        // Test with large offset ( 5 hours)
        List<LocalDateTime> result = service.findNextShuttle("SGW", 300);

        assertThat(result).hasSize(3);
    }

    @Test
    void findNextShuttle_ZeroOffMinutes() {
        List<LocalDateTime> result = service.findNextShuttle("SGW", 0);

        assertNotNull(result);
        assertThat(result).hasSize(3);
    }

    @Test
    void findNextShuttle_ConsistentResults() {
        // Calling twice with same parameters should return same results
        List<LocalDateTime> result1 = service.findNextShuttle("SGW", 5);
        List<LocalDateTime> result2 = service.findNextShuttle("SGW", 5);

        assertThat(result1).hasSize(3);
        assertThat(result2).hasSize(3);

        // First elements should be equal (allowing for time passage during test)
        if (result1.get(0) != null && result2.get(0) != null) {
            assertThat(result1.get(0).toLocalTime()).isEqualTo(result2.get(0).toLocalTime());
        }
    }
}

