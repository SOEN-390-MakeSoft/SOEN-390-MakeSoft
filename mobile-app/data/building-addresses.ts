// SGW building list for name/address enrichment.

export type BuildingAddress = {
    code: string;
    name: string;
    address: string;
    aliases?: string[];
};

export const BUILDING_ADDRESSES: BuildingAddress[] = [
    { code: "B", name: "B Annex", address: "2160 Bishop St, Montreal, QC" },
    { code: "CI", name: "CI Annex", address: "2149 Mackay St, Montreal, QC" },
    { code: "CL", name: "CL Annex", address: "1665 Ste-Catherine St W, Montreal, QC" },
    { code: "D", name: "D Annex", address: "2140 Bishop St, Montreal, QC" },
    { code: "EN", name: "EN Annex", address: "2070 Mackay St, Montreal, QC" },
    { code: "ER", name: "ER Building", address: "2155 Guy St, Montreal, QC" },
    {
        code: "EV",
        name: "Engineering, Computer Science and Visual Arts Integrated Complex",
        address: "1515 Ste-Catherine St W, Montreal, QC",
        aliases: ["EV Building"],
    },
    { code: "FA", name: "FA Annex", address: "2060 Mackay St, Montreal, QC" },
    {
        code: "FB",
        name: "Faubourg Building",
        address: "1250 Guy St, Montreal, QC / 1600 Ste-Catherine St W, Montreal, QC",
        aliases: ["Faubourg Ste-Catherine Building"],
    },
    {
        code: "FG",
        name: "Faubourg Ste-Catherine Building",
        address: "1610 Ste-Catherine St W, Montreal, QC",
    },
    {
        code: "GA",
        name: "Grey Nuns Annex",
        address: "1211-1215 St-Mathieu St, Montreal, QC",
    },
    {
        code: "GM",
        name: "Guy-De Maisonneuve Building",
        address: "1550 De Maisonneuve Blvd W, Montreal, QC",
    },
    {
        code: "GN",
        name: "Grey Nuns Building",
        address: "1190 Guy St, Montreal, QC",
        aliases: [
            "Grey Nuns Building (St-Mathieu Entrance)",
            "1175 St-Mathieu St",
            "Maison-Mere des Soeurs grises",
        ],
    },
    { code: "GS", name: "GS Building", address: "1538 Sherbrooke St W, Montreal, QC" },
    {
        code: "H",
        name: "Henry F. Hall Building",
        address: "1455 De Maisonneuve Blvd W, Montreal, QC",
        aliases: ["Hall Building"],
    },
    { code: "K", name: "K Annex", address: "2150 Bishop St, Montreal, QC" },
    {
        code: "LB",
        name: "J.W. McConnell Building",
        address: "1400 De Maisonneuve Blvd W, Montreal, QC",
    },
    { code: "LD", name: "LD Building", address: "1424 Bishop St, Montreal, QC" },
    { code: "LS", name: "Learning Square", address: "1535 De Maisonneuve Blvd W, Montreal, QC" },
    { code: "M", name: "M Annex", address: "2135 Mackay St, Montreal, QC" },
    { code: "MB", name: "John Molson Building", address: "1450 Guy St, Montreal, QC" },
    { code: "MI", name: "MI Annex", address: "2130 Bishop St, Montreal, QC" },
    { code: "MU", name: "MU Annex", address: "2170 Bishop St, Montreal, QC" },
    { code: "P", name: "P Annex", address: "2020 Mackay St, Montreal, QC" },
    { code: "PR", name: "PR Annex", address: "2100 Mackay St, Montreal, QC" },
    { code: "Q", name: "Q Annex", address: "2010 Mackay St, Montreal, QC" },
    { code: "R", name: "R Annex", address: "2050 Mackay St, Montreal, QC" },
    { code: "RR", name: "RR Annex", address: "2040 Mackay St, Montreal, QC" },
    { code: "S", name: "S Annex", address: "2145 Mackay St, Montreal, QC" },
    {
        code: "SB",
        name: "Samuel Bronfman Building",
        address: "1590 Docteur-Penfield Ave, Montreal, QC",
    },
    { code: "T", name: "T Annex", address: "2030 Mackay St, Montreal, QC" },
    { code: "TD", name: "Toronto-Dominion Building", address: "1410 Guy St, Montreal, QC" },
    { code: "V", name: "V Annex", address: "2110 Mackay St, Montreal, QC" },
    {
        code: "VA",
        name: "Visual Arts Building",
        address: "1395 Rene-Levesque Blvd W, Montreal, QC",
    },
    { code: "X", name: "X Annex", address: "2080 Mackay St, Montreal, QC" },
    { code: "Z", name: "Z Annex", address: "2090 Mackay St, Montreal, QC" },
];
