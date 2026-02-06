const loadApiModule = (options: {
    platformOS: "ios" | "android" | "web";
    isDevice: boolean;
    extraPCIP?: string;
    axiosGetImpl?: jest.Mock;
}) => {
    jest.resetModules();

    const axiosCreate = jest.fn(() => ({
        get: options.axiosGetImpl ?? jest.fn(),
    }));

    jest.doMock("axios", () => ({
        __esModule: true,
        default: { create: axiosCreate },
    }));

    jest.doMock("react-native", () => ({
        __esModule: true,
        Platform: { OS: options.platformOS },
    }));

    jest.doMock("expo-constants", () => ({
        __esModule: true,
        default: {
            isDevice: options.isDevice,
            expoConfig: {
                extra: options.extraPCIP ? { PC_IP: options.extraPCIP } : undefined,
            },
            manifest: {
                extra: options.extraPCIP ? { PC_IP: options.extraPCIP } : undefined,
            },
        },
    }));

    return { ...require("../services/api"), axiosCreate };
};

describe("api service", () => {
    it("uses android emulator host on android simulator", () => {
        const { API_BASE_URL } = loadApiModule({
            platformOS: "android",
            isDevice: false,
        });

        expect(API_BASE_URL).toBe("http://10.0.2.2:8081/api");
    });

    it("uses normalized env host on device", () => {
        const { API_BASE_URL } = loadApiModule({
            platformOS: "ios",
            isDevice: true,
            extraPCIP: "192.168.1.20",
        });

        expect(API_BASE_URL).toBe("http://192.168.1.20:8081/api");
    });

    it("returns success on testConnection", async () => {
        const axiosGetImpl = jest.fn().mockResolvedValue({ data: { ok: true } });
        const { testConnection } = loadApiModule({
            platformOS: "ios",
            isDevice: false,
            axiosGetImpl,
        });

        const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);

        const result = await testConnection();

        expect(result).toEqual({ success: true, data: { ok: true } });
        consoleSpy.mockRestore();
    });

    it("returns error on testConnection failure", async () => {
        const axiosGetImpl = jest.fn().mockRejectedValue(new Error("Boom"));
        const { testConnection } = loadApiModule({
            platformOS: "ios",
            isDevice: false,
            axiosGetImpl,
        });

        const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);

        const result = await testConnection();

        expect(result).toEqual({ success: false, error: "Boom" });
        consoleSpy.mockRestore();
    });
});
