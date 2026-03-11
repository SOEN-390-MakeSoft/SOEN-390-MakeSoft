const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve .geojson files as source modules (not static assets)
config.resolver.sourceExts.push('geojson');

// Use a custom transformer so .geojson files are treated as JSON, not parsed as JS by Babel
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('./metro-transformer.js'),
};

module.exports = config;
