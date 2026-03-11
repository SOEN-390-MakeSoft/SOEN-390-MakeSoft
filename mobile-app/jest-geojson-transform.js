module.exports = {
  process(sourceText, sourcePath) {
    // Read and parse the JSON, then export as a JS module
    const json = JSON.parse(sourceText);
    return {
      code: `module.exports = ${JSON.stringify(json)};`,
    };
  },
};
