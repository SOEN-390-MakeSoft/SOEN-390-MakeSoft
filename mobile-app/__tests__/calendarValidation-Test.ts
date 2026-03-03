import { isClassesCalendarValid } from '../utils/calendarValidation';

describe('calendarValidation', () => {
  describe('isClassesCalendarValid', () => {
    it('returns true when calendar is connected (happy path)', () => {
      // Arrange
      const isConnected = true;

      // Act
      const result = isClassesCalendarValid(isConnected);

      // Assert
      expect(result).toBe(true);
    });

    it('returns false when calendar is not connected (failure case)', () => {
      // Arrange
      const isConnected = false;

      // Act
      const result = isClassesCalendarValid(isConnected);

      // Assert
      expect(result).toBe(false);
    });

    it('treats truthy non-boolean as valid (edge case)', () => {
      // Arrange - in JS, truthy values could be passed
      // Act
      const result = isClassesCalendarValid(1 as unknown as boolean);

      // Assert
      expect(result).toBe(true);
    });

    it('treats falsy non-boolean as invalid (edge case)', () => {
      // Arrange
      // Act
      const result = isClassesCalendarValid(0 as unknown as boolean);

      // Assert
      expect(result).toBe(false);
    });
  });
});
