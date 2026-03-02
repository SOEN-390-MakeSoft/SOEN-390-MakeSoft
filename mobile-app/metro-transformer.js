/**
 * Custom Metro transformer that handles .geojson files as JSON modules.
 *
 * For .geojson files the raw JSON text is wrapped in `module.exports = …`
 * so Babel sees valid JavaScript. All other files are forwarded unchanged
 * to Expo's default Babel transformer.
 */
const upstreamTransformer = require('@expo/metro-config/babel-transformer');

module.exports.transform = async function ({ src, filename, options }) {
  if (filename.endsWith('.geojson')) {
    // Wrap the raw JSON as a CommonJS module so Babel can process it
    return upstreamTransformer.transform({
      src: `module.exports = ${src};`,
      filename: filename + '.js',
      options,
    });
  }
  return upstreamTransformer.transform({ src, filename, options });
};
