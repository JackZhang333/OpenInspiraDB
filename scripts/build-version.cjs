function pad(value) {
  return String(value).padStart(2, "0");
}

function makeBuildVersion(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());

  // Apple accepts numeric dot-separated build versions. A UTC timestamp keeps
  // each MAS upload monotonic without requiring manual edits to package.json.
  return `${year}${month}${day}.${hours}${minutes}${seconds}`;
}

module.exports = {
  makeBuildVersion,
};
