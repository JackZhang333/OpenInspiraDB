const { build } = require("./package.json");
const { makeBuildVersion } = require("./scripts/build-version.cjs");

const distributionIdentity = "Apple Distribution: Xiao Shan Zhang (5UG53HWCJG)";
const buildVersion = process.env.BUILD_BUNDLE_VERSION || makeBuildVersion();

module.exports = {
  ...build,
  buildVersion,
  mac: {
    ...build.mac,
    identity: distributionIdentity,
    provisioningProfile: "build/profiles/mas.provisionprofile",
    target: [{ target: "mas", arch: ["universal"] }],
    type: "distribution",
  },
  mas: {
    ...(build.mas || {}),
    provisioningProfile: "build/profiles/mas.provisionprofile",
    type: "distribution",
  },
};
