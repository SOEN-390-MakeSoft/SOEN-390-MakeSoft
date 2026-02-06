import { BUILDING_POLYGONS } from "../src/data/buildingPolygons";

describe("src building polygons data", () => {
    it("exports polygon data", () => {
        expect(Object.keys(BUILDING_POLYGONS).length).toBeGreaterThan(0);
    });
});
