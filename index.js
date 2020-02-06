const { execSync } = require("child_process");
const { createWriteStream } = require("fs");
const path = require("path");
const { format } = require("@fast-csv/format");
const { parseFile } = require("@fast-csv/parse");
const semver = require("semver");

const fetchPackageMeta = packageName => {
  try {
    const output = execSync(`npm view ${packageName} --json`).toString();
    const time = execSync(`npm view ${packageName} time --json`).toString();
    return { ...JSON.parse(output), time: JSON.parse(time) };
  } catch (e) {
    console.log(`Error fetching/parsing metadata for ${packageName}`);
    console.log(e);
  }
};

const main = () => {
  const csvStream = format({
    delimiter: ";",
    quote: '"',
    quoteColumns: true
  });

  const fileStream = createWriteStream(path.join(__dirname, "metadata.csv"));

  fileStream.on("error", e => console.log("fileStream error: ", e));

  csvStream
    .pipe(fileStream)
    .on("error", e => console.log("csvStream error: ", e));

  parseFile(path.join(__dirname, "packages.csv"), { headers: true })
    .on("error", e => console.log("parseFile error: ", e))
    .on("data", ({ name, versionString, manager }) => {
      console.log(`Processing package ${name}`);

      const metadata = manager === "NPM" ? fetchPackageMeta(name) : "";

      const time = metadata && metadata.time;

      let versionRelease = "";
      let latestRelease = "";

      const latest =
        metadata && metadata["dist-tags"] && metadata["dist-tags"].latest;

      if (time) {
        const [, timestamp] = Object.entries(time)
          .reverse()
          .find(([version, timestamp]) =>
            semver.satisfies(version, versionString)
          );
        versionRelease = timestamp;

        const [, timestampRelease] = Object.entries(time)
          .reverse()
          .find(([version, timestamp]) => version === latest);
        latestRelease = timestampRelease;
      }

      csvStream.write([
        name,
        versionString,
        versionRelease,
        latest,
        latestRelease,
        metadata && metadata.description,
        metadata &&
          (metadata.homepage ||
            (metadata.repository && metadata.repository.url)),
        metadata && metadata.license
      ]);
    })
    .on("end", () => csvStream.end());
};

main();
