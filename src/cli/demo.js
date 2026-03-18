import path from 'node:path';
import { InspiraDBApp } from '../index.js';

function parseTags(args) {
  const flag = args.find((item) => item.startsWith('--tags='));
  if (!flag) {
    return [];
  }
  return flag.replace('--tags=', '').split(',').map((item) => item.trim()).filter(Boolean);
}

function parsePage(args) {
  const flag = args.find((item) => item.startsWith('--page='));
  return flag ? Number(flag.replace('--page=', '')) : 1;
}

function parsePageSize(args) {
  const flag = args.find((item) => item.startsWith('--page-size='));
  return flag ? Number(flag.replace('--page-size=', '')) : 50;
}

function usage() {
  console.log(`
InspiraDB V1-A Demo CLI

Commands:
  import-file <filePath>
  import-folder <folderPath>
  search [query] [--tags=标签1,标签2] [--page=1] [--page-size=50]
  detail <imageId>
  update-caption <imageId> <caption>
  update-tags <imageId> <tag1,tag2>
  retry <jobId>
  reanalyze <imageId>
  delete <imageId>
  sleep <ms>
`);
}

async function main() {
  const [, , command, ...args] = process.argv;
  if (!command) {
    usage();
    process.exit(0);
  }

  const app = new InspiraDBApp({
    rootDir: path.resolve(process.cwd()),
    autoStartQueue: true,
  });

  try {
    if (command === 'import-file') {
      const filePath = args[0];
      const result = await app.importFile(filePath);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === 'import-folder') {
      const folderPath = args[0];
      const result = await app.importFolder(folderPath);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === 'search') {
      const query = args.find((item) => !item.startsWith('--')) || '';
      const tags = parseTags(args);
      const page = parsePage(args);
      const pageSize = parsePageSize(args);
      const result = await app.searchImages(query, tags, { page, pageSize });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === 'detail') {
      const imageId = Number(args[0]);
      const result = app.getImageDetail(imageId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === 'update-caption') {
      const imageId = Number(args[0]);
      const caption = args.slice(1).join(' ').trim();
      const result = await app.updateImageCaption(imageId, caption);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === 'update-tags') {
      const imageId = Number(args[0]);
      const tags = (args[1] || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const result = app.updateImageTags(imageId, tags);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === 'retry') {
      const jobId = Number(args[0]);
      const result = await app.retryAnalysis(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === 'reanalyze') {
      const imageId = Number(args[0]);
      const result = await app.rebuildImageAnalysis(imageId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === 'delete') {
      const imageId = Number(args[0]);
      const result = app.deleteImage(imageId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === 'sleep') {
      const ms = Number(args[0] || 1000);
      await new Promise((resolve) => setTimeout(resolve, ms));
      console.log(JSON.stringify({ sleptMs: ms }));
      return;
    }

    usage();
    process.exitCode = 1;
  } finally {
    app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
