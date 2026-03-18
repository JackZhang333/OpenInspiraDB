const { build } = require("./package.json");

const distributionIdentity = "Apple Distribution: Xiao Shan Zhang (5UG53HWCJG)";

module.exports = {
  ...build,
  mac: {
    ...build.mac,
    identity: distributionIdentity,
    provisioningProfile: "build/profiles/mas.provisionprofile",
    target: ["mas"],
    type: "distribution",
  },
  mas: {
    ...(build.mas || {}),
    identity: distributionIdentity,
    provisioningProfile: "build/profiles/mas.provisionprofile",
    type: "distribution",
  },
};
