import { useEffect, useState } from "react";
import MapView from "react-native-maps";
import { BuildingResponse, getBuildingById } from "../services/api";
import { polygonCentroid } from "../utils/mapUtils";

type LatLng = { latitude: number; longitude: number };

type Building = {
    id: string;
    name: string;
    address: string | null;
    code: string | null;
    polygon: readonly LatLng[];
};


 //Hook to manage building selection and remote building data fetching
 
export function useSelectedBuilding(buildings: Building[], mapRef: React.RefObject<MapView | null>) {
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
    const [remoteBuilding, setRemoteBuilding] = useState<BuildingResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? null;

    // Effect: Fetch building details from API when selection changes
    useEffect(() => {
        if (!selectedBuildingId || !selectedBuilding) {
            setRemoteBuilding(null);
            setIsLoading(false);
            setErrorMessage(null);
            return;
        }

        const numericId = Number(selectedBuildingId);
        const requestId = Number.isFinite(numericId) ? numericId : null;

        if (!requestId) {
            setRemoteBuilding(null);
            setIsLoading(false);
            setErrorMessage("Invalid building ID.");
            return;
        }

        let isActive = true;
        setIsLoading(true);
        setErrorMessage(null);
        getBuildingById(requestId)
            .then((data) => {
                if (!isActive) return;
                setRemoteBuilding(data);
            })
            .catch((error) => {
                if (!isActive) return;
                setRemoteBuilding(null);
                const status = (error as { response?: { status?: number } })?.response?.status;
                if (status === 404) {
                    setErrorMessage("Building details not available.");
                } else {
                    setErrorMessage("Unable to load building details.");
                }
            })
            .finally(() => {
                if (!isActive) return;
                setIsLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [selectedBuilding, selectedBuildingId]);

    
     // Selects a building by ID and animates the map to it
     
    const handleSelectBuilding = (id: string) => {
        setSelectedBuildingId(id);
        setErrorMessage(null);
        setIsLoading(false);
        setRemoteBuilding(null);
        const building = buildings.find((item) => item.id === id);
        if (building) {
            const centroid = polygonCentroid(building.polygon);
            mapRef.current?.animateToRegion(
                { ...centroid, latitudeDelta: 0.0032, longitudeDelta: 0.0032 },
                500
            );
        }
    };

    
      //Closes the building info card and clears selection
     
    const handleCloseCard = () => {
        setSelectedBuildingId(null);
        setErrorMessage(null);
        setIsLoading(false);
        setRemoteBuilding(null);
    };

    return {
        selectedBuildingId,
        selectedBuilding,
        remoteBuilding,
        isLoading,
        errorMessage,
        handleSelectBuilding,
        handleCloseCard,
    };
}