const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withProjectBuildGradle,
} = require("@expo/config-plugins");

const DETOX_AAR_REPO = '$rootDir/../node_modules/detox/Detox-android';
const LIBFJNI_PICKFIRSTS =
  '["**/libfbjni.so", "lib/**/libfbjni.so", "lib/arm64-v8a/libfbjni.so"]';

function ensureLine(contents, line) {
  return contents.includes(line) ? contents : `${contents}\n${line}\n`;
}

function withDetoxAndroid(config) {
  const androidPackage = config.android?.package || "com.soen390.makesoft";
  config = withProjectBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes("Detox-android")) {
      contents = contents.replace(
        /allprojects\s*{\s*repositories\s*{/,
        (match) => {
          const lines = [match];
          if (!contents.includes("mavenLocal()")) {
            lines.push("    mavenLocal()");
          }
          lines.push(`    maven { url "${DETOX_AAR_REPO}" }`);
          return lines.join("\n");
        }
      );
    }

    if (!contents.includes("libfbjni.so") || !contents.includes("com.android.library")) {
      contents = ensureLine(
        contents,
        [
          "subprojects { subproject ->",
          "  subproject.plugins.withId(\"com.android.library\") {",
          "    subproject.android.packagingOptions {",
          `      pickFirsts += ${LIBFJNI_PICKFIRSTS}`,
          "    }",
          "  }",
          "}",
        ].join("\n")
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });

  config = withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes("testInstrumentationRunner")) {
      contents = contents.replace(
        /defaultConfig\s*{/,
        (match) => `${match}\n        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"`
      );
    }

    if (!contents.includes("GOOGLE_MAPS_API_KEY")) {
      const mapLines =
        '        def mapsApiKey = System.getenv("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID") ?: ""\n' +
        '        manifestPlaceholders = [GOOGLE_MAPS_API_KEY: mapsApiKey]';
      if (contents.includes("testInstrumentationRunner")) {
        contents = contents.replace(
          /testInstrumentationRunner\s+"androidx\.test\.runner\.AndroidJUnitRunner"\s*\n/,
          (match) => `${match}${mapLines}\n`
        );
      } else {
        contents = contents.replace(
          /defaultConfig\s*{/,
          (match) => `${match}\n${mapLines}`
        );
      }
    }

    if (!/debuggableVariants\s*=/.test(contents)) {
      if (contents.includes('bundleCommand = "export:embed"')) {
        contents = contents.replace(
          /bundleCommand\s*=\s*"export:embed"\s*\n/,
          (match) => `${match}    debuggableVariants = ["debugOptimized"]\n`
        );
      } else {
        contents = contents.replace(
          /react\s*{/,
          (match) => `${match}\n    debuggableVariants = ["debugOptimized"]\n`
        );
      }
    }

    if (!contents.includes("pickFirsts") || !contents.includes("libfbjni.so")) {
      contents = contents.replace(
        /packagingOptions\s*{/,
        (match) => `${match}\n        pickFirsts += ${LIBFJNI_PICKFIRSTS}`
      );
    }

    const detoxVersionLine = 'androidTestImplementation("com.wix:detox:';
    if (!contents.includes(detoxVersionLine)) {
      const version = getDetoxVersion(mod.modRequest.projectRoot);
      contents = contents.replace(
        /dependencies\s*{/,
        (match) => `${match}\n    androidTestImplementation("com.wix:detox:${version}")`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });

  config = withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      "com.google.android.geo.API_KEY",
      "${GOOGLE_MAPS_API_KEY}"
    );
    return mod;
  });

  config = withDangerousMod(config, [
    "android",
    async (mod) => {
      const androidRoot = mod.modRequest.platformProjectRoot;
      const packagePath = androidPackage.replace(/\./g, "/");

      const androidTestDir = path.join(
        androidRoot,
        "app",
        "src",
        "androidTest"
      );
      const manifestPath = path.join(androidTestDir, "AndroidManifest.xml");
      const javaDir = path.join(androidTestDir, "java", packagePath);
      const detoxTestPath = path.join(javaDir, "DetoxTest.java");

      fs.mkdirSync(javaDir, { recursive: true });

      fs.writeFileSync(
        manifestPath,
        `<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:tools="http://schemas.android.com/tools">\n\n    <application>\n        <activity\n            android:name="androidx.test.core.app.InstrumentationActivityInvoker$BootstrapActivity"\n            android:exported="true"\n            tools:node="merge"\n            tools:replace="android:exported" />\n        <activity\n            android:name="androidx.test.core.app.InstrumentationActivityInvoker$EmptyActivity"\n            android:exported="true"\n            tools:node="merge"\n            tools:replace="android:exported" />\n        <activity\n            android:name="androidx.test.core.app.InstrumentationActivityInvoker$EmptyFloatingActivity"\n            android:exported="true"\n            tools:node="merge"\n            tools:replace="android:exported" />\n    </application>\n</manifest>\n`
      );

      fs.writeFileSync(
        detoxTestPath,
        `package ${androidPackage};\n\nimport com.wix.detox.Detox;\nimport com.wix.detox.config.DetoxConfig;\nimport org.junit.Rule;\nimport org.junit.Test;\nimport org.junit.runner.RunWith;\n\nimport androidx.test.ext.junit.runners.AndroidJUnit4;\nimport androidx.test.rule.ActivityTestRule;\n\n@RunWith(AndroidJUnit4.class)\npublic class DetoxTest {\n  @Rule\n  public ActivityTestRule<MainActivity> rule = new ActivityTestRule<>(MainActivity.class, false, false);\n\n  @Test\n  public void runDetoxTests() {\n    DetoxConfig detoxConfig = new DetoxConfig();\n    Detox.runTests(rule, detoxConfig);\n  }\n}\n`
      );

      return mod;
    },
  ]);

  return config;
}

function getDetoxVersion(projectRoot) {
  try {
    const detoxPkgPath = path.join(projectRoot, "node_modules", "detox", "package.json");
    const detoxPkg = JSON.parse(fs.readFileSync(detoxPkgPath, "utf8"));
    return detoxPkg.version || "20.47.0";
  } catch {
    return "20.47.0";
  }
}

module.exports = withDetoxAndroid;
