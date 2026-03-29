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
  openclaw-status              Check OpenClaw service status
  co-evolution-start          Start tag co-evolution analysis
  co-evolution-apply          Apply co-evolution suggestions (interactive)
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

    if (command === 'openclaw-status') {
      const status = await app.checkOpenClawStatus();
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    if (command === 'co-evolution-start') {
      console.log('Starting co-evolution analysis...');
      const result = await app.startCoEvolution();
      console.log(JSON.stringify({
        sessionId: result.sessionId,
        openClawSessionId: result.openClawSessionId,
        status: result.status,
        stats: result.stats,
        suggestionCount: result.suggestions.length,
        suggestions: result.suggestions.map(s => ({
          id: s.id,
          kind: s.kind,
          confidence: s.confidence,
          reason: s.reason,
        })),
      }, null, 2));
      return;
    }

    if (command === 'co-evolution-apply') {
      const session = app.getCoEvolutionSession();
      if (!session) {
        console.error('Error: No active co-evolution session. Run "co-evolution-start" first.');
        process.exitCode = 1;
        return;
      }

      const readline = await import('node:readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

      try {
        console.log(`\nFound ${session.suggestions.length} suggestions:`);
        for (const s of session.suggestions) {
          console.log(`  [${s.kind}] ${s.name || s.targetTagName || ''} (confidence: ${Math.round(s.confidence * 100)}%)`);
          console.log(`    Reason: ${s.reason}`);
        }

        const answer = await question('\nEnter suggestion IDs to apply (comma-separated), or "all": ');
        let selectedIds;
        if (answer.trim().toLowerCase() === 'all') {
          selectedIds = session.suggestions.map(s => s.id);
        } else {
          selectedIds = answer.split(',').map(id => id.trim()).filter(Boolean);
        }

        if (selectedIds.length === 0) {
          console.log('No suggestions selected.');
          return;
        }

        const ratingAnswer = await question('Rate the suggestions 1-5 (optional, press Enter to skip): ');
        const userRating = ratingAnswer.trim() ? Number(ratingAnswer) : null;

        console.log('\nApplying suggestions...');
        const result = await app.applyCoEvolutionSuggestions(selectedIds, { userRating });
        console.log(JSON.stringify({
          appliedCount: result.appliedCount,
          skippedCount: result.skippedCount,
          affectedImageCount: result.affectedImageCount,
        }, null, 2));
      } finally {
        rl.close();
      }
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
