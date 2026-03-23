// app.config.js
module.exports = ({ config }) => {
  const existingPlugins = config.plugins || [];
  const withDetoxPlugin = './plugins/withDetoxAndroid';

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
      ...(config.extra || {}),
      PC_IP: process.env.EXPO_PUBLIC_PC_IP || process.env.REACT_NATIVE_PACKAGER_HOSTNAME || null,
      eas: {
        ...(config.extra?.eas || {}),
        projectId: 'da8519b7-5d4a-4196-b682-8b3c43080ff0',
      },
    },

    plugins: existingPlugins.includes(withDetoxPlugin)
      ? existingPlugins
      : [...existingPlugins, withDetoxPlugin],
  };
};
