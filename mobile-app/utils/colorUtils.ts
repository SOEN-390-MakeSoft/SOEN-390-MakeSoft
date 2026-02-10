/**
 * Gets color for a feature based on its availability status
 * @param value Boolean indicating availability, or null if unknown
 * @returns Color hex code
 */
export function getFeatureColor(value: boolean | null): string {
    if (value === true) return "#b21b2c";  // Concordia red - available
    if (value === false) return "#b8b8b8"; // Gray - not available
    return "#d6d6d6"; // Light gray - unknown
}

/**
 * Gets color for metro access based on availability status
 * @param value Boolean indicating metro access, or null if unknown
 * @returns Color hex code
 */
export function getMetroColor(value: boolean | null): string {
    if (value === true) return "#2f6fe4";  // Blue - metro access
    if (value === false) return "#b8b8b8"; // Gray - no metro access
    return "#d6d6d6"; // Light gray - unknown
}
