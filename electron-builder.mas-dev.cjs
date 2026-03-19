const { build } = require("./package.json");
const { makeBuildVersion } = require("./scripts/build-version.cjs");

const buildVersion = process.env.BUILD_BUNDLE_VERSION || makeBuildVersion();

module.exports = {
  ...build,
  buildVersion,
  mac: {
    ...build.mac,
    type: "development",
    provisioningProfile: "build/profiles/mas-dev.provisionprofile",
    target: [{ target: "mas", arch: ["universal"] }],
  },
  mas: {
    ...(build.mas || {}),
    ...(build.masDev || {}),
    type: "development",
    provisioningProfile: "build/profiles/mas-dev.provisionprofile",
  },
};
