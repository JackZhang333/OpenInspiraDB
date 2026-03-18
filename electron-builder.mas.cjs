const { build } = require("./package.json");

const distributionIdentity = "Apple Distribution: Xiao Shan Zhang (5UG53HWCJG)";

module.exports = {
  ...build,
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
