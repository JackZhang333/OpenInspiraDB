const { build } = require("./package.json");

module.exports = {
  ...build,
  mac: {
    ...build.mac,
    type: "development",
    provisioningProfile: "build/profiles/mas-dev.provisionprofile",
    target: ["mas"],
  },
  mas: {
    ...(build.mas || {}),
    ...(build.masDev || {}),
    type: "development",
    provisioningProfile: "build/profiles/mas-dev.provisionprofile",
  },
};
