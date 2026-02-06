// Setup file for Jest

jest.mock("@expo/vector-icons", () => {
    const React = require("react");
    const { Text } = require("react-native");
    return {
        __esModule: true,
        MaterialIcons: (props) => React.createElement(Text, { ...props }),
    };
});

jest.mock("@expo/vector-icons/MaterialIcons", () => {
    const React = require("react");
    const { Text } = require("react-native");
    return {
        __esModule: true,
        default: (props) => React.createElement(Text, { ...props }),
    };
});
