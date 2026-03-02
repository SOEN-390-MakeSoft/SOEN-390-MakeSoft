/**
 * Jest transform for .geojson files.
 * Reads the file as JSON and exports it as a module.
 */
const fs = require('fs');

module.exports = {
  process(sourceText, sourcePath) {
    // Read and parse the JSON, then export as a JS module
    const json = JSON.parse(sourceText);
    return {
      code: `module.exports = ${JSON.stringify(json)};`,
    };
  },
};
