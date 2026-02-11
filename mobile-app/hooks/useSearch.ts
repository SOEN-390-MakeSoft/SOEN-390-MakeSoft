import { useMemo, useRef, useState } from "react";
import { TextInput } from "react-native";
import { normalizeLabel } from "../utils/stringUtils";

type Building = {
    id: string;
    name: string;
    address: string | null;
    code: string | null;
    polygon: readonly { latitude: number; longitude: number }[];
};

/**
 * Hook to manage search functionality including query, focus state, and results
 */
export function useSearch(buildings: Building[], onSelectResult: (building: Building) => void) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const searchInputRef = useRef<TextInput>(null);

    // Memoized search results filtering
    const searchResults = useMemo(() => {
        const query = normalizeLabel(searchQuery);
        if (!query) return [];
        return buildings
            .filter((building) => {
                const name = normalizeLabel(building.name);
                const code = building.code ? normalizeLabel(building.code) : "";
                const address = building.address ? normalizeLabel(building.address) : "";
                return (
                    name.includes(query) ||
                    code.includes(query) ||
                    address.includes(query)
                );
            })
            .slice(0, 6);
    }, [buildings, searchQuery]);

    /**
     * Handles search submission - selects first result if available
     */
    const handleSearchSubmit = () => {
        if (searchResults.length === 0) return;
        handleSelectSearchResult(searchResults[0]);
    };

    /**
     * Handles selection of a search result
     */
    const handleSelectSearchResult = (building: Building) => {
        setSearchQuery(building.name);
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
        onSelectResult(building);
    };

    return {
        searchQuery,
        setSearchQuery,
        isSearchFocused,
        setIsSearchFocused,
        searchInputRef,
        searchResults,
        handleSearchSubmit,
        handleSelectSearchResult,
    };
}
