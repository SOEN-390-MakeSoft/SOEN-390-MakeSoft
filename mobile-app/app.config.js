// app.config.js — expose REACT_NATIVE_PACKAGER_HOSTNAME (or EXPO_PUBLIC_PC_IP) to Expo runtime
module.exports = ({ config }) => {
  const existingPlugins = config.plugins || [];
  const withDetoxPlugin = "./plugins/withDetoxAndroid";

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID,
        },
      },
    },

    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS,
      },
    },

    extra: {
      PC_IP: process.env.EXPO_PUBLIC_PC_IP || process.env.REACT_NATIVE_PACKAGER_HOSTNAME || null,
    },
    plugins: existingPlugins.includes(withDetoxPlugin)
      ? existingPlugins
      : [...existingPlugins, withDetoxPlugin],
  };
};
