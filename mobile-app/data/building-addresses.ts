// SGW building list for name/address enrichment.

export type BuildingAddress = {
    code: string;
    name: string;
    address: string;
    aliases?: string[];
};

const makeBuilding = (
    code: string,
    name: string,
    address: string,
    aliases?: string[]
): BuildingAddress => (aliases ? { code, name, address, aliases } : { code, name, address });

const makeAnnex = (code: string, address: string): BuildingAddress =>
    makeBuilding(code, `${code} Annex`, address);

export const BUILDING_ADDRESSES: BuildingAddress[] = [
    makeAnnex("B", "2160 Bishop St, Montreal, QC"),
    makeAnnex("CI", "2149 Mackay St, Montreal, QC"),
    makeAnnex("CL", "1665 Ste-Catherine St W, Montreal, QC"),
    makeAnnex("D", "2140 Bishop St, Montreal, QC"),
    makeAnnex("EN", "2070 Mackay St, Montreal, QC"),
    makeBuilding("ER", "ER Building", "2155 Guy St, Montreal, QC"),
    makeBuilding(
        "EV",
        "Engineering, Computer Science and Visual Arts Integrated Complex",
        "1515 Ste-Catherine St W, Montreal, QC",
        ["EV Building"]
    ),
    makeAnnex("FA", "2060 Mackay St, Montreal, QC"),
    makeBuilding(
        "FB",
        "Faubourg Building",
        "1250 Guy St, Montreal, QC / 1600 Ste-Catherine St W, Montreal, QC",
        ["Faubourg Ste-Catherine Building"]
    ),
    makeBuilding(
        "FG",
        "Faubourg Ste-Catherine Building",
        "1610 Ste-Catherine St W, Montreal, QC"
    ),
    makeBuilding(
        "GA",
        "Grey Nuns Annex",
        "1211-1215 St-Mathieu St, Montreal, QC"
    ),
    makeBuilding(
        "GM",
        "Guy-De Maisonneuve Building",
        "1550 De Maisonneuve Blvd W, Montreal, QC"
    ),
    makeBuilding(
        "GN",
        "Grey Nuns Building",
        "1190 Guy St, Montreal, QC",
        ["Grey Nuns Building (St-Mathieu Entrance)", "1175 St-Mathieu St"]
    ),
    makeBuilding("GS", "GS Building", "1538 Sherbrooke St W, Montreal, QC"),
    makeBuilding(
        "H",
        "Henry F. Hall Building",
        "1455 De Maisonneuve Blvd W, Montreal, QC",
        ["Hall Building"]
    ),
    makeAnnex("K", "2150 Bishop St, Montreal, QC"),
    makeBuilding(
        "LB",
        "J.W. McConnell Building",
        "1400 De Maisonneuve Blvd W, Montreal, QC"
    ),
    makeBuilding("LD", "LD Building", "1424 Bishop St, Montreal, QC"),
    makeBuilding("LS", "Learning Square", "1535 De Maisonneuve Blvd W, Montreal, QC"),
    makeAnnex("M", "2135 Mackay St, Montreal, QC"),
    makeBuilding("MB", "John Molson Building", "1450 Guy St, Montreal, QC"),
    makeAnnex("MI", "2130 Bishop St, Montreal, QC"),
    makeAnnex("MU", "2170 Bishop St, Montreal, QC"),
    makeAnnex("P", "2020 Mackay St, Montreal, QC"),
    makeAnnex("PR", "2100 Mackay St, Montreal, QC"),
    makeAnnex("Q", "2010 Mackay St, Montreal, QC"),
    makeAnnex("R", "2050 Mackay St, Montreal, QC"),
    makeAnnex("RR", "2040 Mackay St, Montreal, QC"),
    makeAnnex("S", "2145 Mackay St, Montreal, QC"),
    makeBuilding(
        "SB",
        "Samuel Bronfman Building",
        "1590 Docteur-Penfield Ave, Montreal, QC"
    ),
    makeAnnex("T", "2030 Mackay St, Montreal, QC"),
    makeBuilding("TD", "Toronto-Dominion Building", "1410 Guy St, Montreal, QC"),
    makeAnnex("V", "2110 Mackay St, Montreal, QC"),
    makeBuilding("VA", "Visual Arts Building", "1395 Rene-Levesque Blvd W, Montreal, QC"),
    makeAnnex("X", "2080 Mackay St, Montreal, QC"),
    makeAnnex("Z", "2090 Mackay St, Montreal, QC"),
];
