import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname under ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define structures
interface Affix {
  id: number;
  affix: string;
  meaning: string;
  examples: string;
  type: 'prefix' | 'suffix';
}

interface WordRoot {
  id: number;
  root: string;
  meaning: string;
  origin: string;
  examples: string;
}

interface EtymEntry {
  name: string;
  clean_name: string;
  etym: string;
  ref: string[];
}

interface DictEntry {
  root: string;
  meaning: string;
  tooltip: string;
}

// Common English stopwords (matching the ones in etymologyMatcher.ts)
const STOPWORDS = new Set([
  'the', 'and', 'for', 'but', 'not', 'are', 'was', 'its', 'our', 'his', 'her', 'she', 
  'you', 'your', 'yours', 'yourself', 'yourselves', 'him', 'himself', 'herself', 'itself',
  'they', 'them', 'their', 'theirs', 'themselves', 'this', 'that', 'these', 'those',
  'with', 'from', 'about', 'above', 'after', 'again', 'against', 'along', 'among', 'around',
  'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'during',
  'under', 'upon', 'within', 'without', 'through', 'throughout', 'until', 'towards',
  'have', 'has', 'had', 'having', 'were', 'been', 'will', 'would', 'shall', 'should',
  'can', 'could', 'may', 'might', 'must', 'does', 'did', 'done', 'doing', 'make', 'made',
  'making', 'go', 'went', 'gone', 'going', 'come', 'came', 'coming', 'take', 'took', 
  'taken', 'taking', 'here', 'there', 'where', 'when', 'why', 'how', 'then', 'than', 
  'else', 'other', 'others', 'some', 'such', 'only', 'even', 'just', 'also', 'very', 
  'more', 'most', 'back', 'down', 'over', 'into', 'onto', 'both', 'each', 'either', 
  'neither', 'many', 'much', 'some', 'any', 'none', 'every', 'other', 'another', 'same', 
  'what', 'which', 'who', 'whom', 'whose', 'something', 'anything', 'nothing', 'someone', 
  'anyone', 'everyone'
]);

async function main() {
  const publicDir = path.resolve(__dirname, '../public');
  const docsDir = path.resolve(__dirname, '../docs');
  const assetsDir = path.resolve(__dirname, '../assets');

  // Ensure assets directory exists
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const affixesPath = path.join(publicDir, 'affixes.json');
  const wordRootsPath = path.join(publicDir, 'wordRoots.json');
  const etymPath = path.join(docsDir, 'etym.json');
  const outputPath = path.join(assetsDir, 'etymo-dictionary.json');
  const outputPathPublic = path.join(publicDir, 'etymo-dictionary.json');

  console.log('Loading datasets...');
  const affixesData: Affix[] = JSON.parse(fs.readFileSync(affixesPath, 'utf8'));
  const wordRootsData: WordRoot[] = JSON.parse(fs.readFileSync(wordRootsPath, 'utf8'));
  
  if (!fs.existsSync(etymPath)) {
    console.error(`Error: etym.json not found at ${etymPath}`);
    process.exit(1);
  }
  const etymData: EtymEntry[] = JSON.parse(fs.readFileSync(etymPath, 'utf8'));

  console.log(`Loaded ${affixesData.length} affixes, ${wordRootsData.length} word roots, and ${etymData.length} etymology entries.`);

  // 1. Normalize core databases
  // Map clean_key -> core item
  interface NormalizedCore {
    name: string; // original affix or root representation
    meaning: string;
    type: 'prefix' | 'suffix' | 'root';
    origin?: string;
  }

  const coreMap = new Map<string, NormalizedCore[]>();

  // Process affixes
  affixesData.forEach(item => {
    const rawPatterns = item.affix.split(/[\/,()]+/);
    rawPatterns.forEach(pattern => {
      const clean = pattern.replace(/^-|-$/g, '').trim().toLowerCase();
      if (!clean) return;

      if (!coreMap.has(clean)) {
        coreMap.set(clean, []);
      }
      coreMap.get(clean)!.push({
        name: item.affix,
        meaning: item.meaning,
        type: item.type
      });
    });
  });

  // Process word roots
  wordRootsData.forEach(item => {
    const rawPatterns = item.root.split(/[\/,]+/);
    rawPatterns.forEach(pattern => {
      const clean = pattern.trim().toLowerCase();
      if (!clean) return;

      if (!coreMap.has(clean)) {
        coreMap.set(clean, []);
      }
      coreMap.get(clean)!.push({
        name: item.root,
        meaning: item.meaning,
        type: 'root',
        origin: item.origin
      });
    });
  });

  console.log(`Normalized into ${coreMap.size} unique core keys.`);

  // 2. Process etymonline entries
  const dictionary: Record<string, DictEntry> = {};
  let matchCount = 0;
  let wordCount = 0;

  etymData.forEach(entry => {
    if (!entry.clean_name) return;

    // Strip * and - from clean_name
    const cleanName = entry.clean_name.replace(/[\*\-]/g, '').trim().toLowerCase();
    if (!cleanName) return;

    // Find if cleanName matches any core keys
    // Matching logic:
    // Either exact match or if clean key is a prefix (length > 2) of cleanName
    const matchedCores: NormalizedCore[] = [];
    for (const [key, cores] of coreMap.entries()) {
      let isMatch = false;
      if (key.length <= 2) {
        isMatch = (cleanName === key);
      } else {
        isMatch = (cleanName === key || cleanName.startsWith(key) || cleanName.includes(key));
      }

      if (isMatch) {
        matchedCores.push(...cores);
      }
    }

    if (matchedCores.length === 0) return;

    matchCount++;

    // Process each word in ref
    if (Array.isArray(entry.ref)) {
      entry.ref.forEach(word => {
        const cleanWord = word.trim().toLowerCase().replace(/[^a-z]/g, '');

        // Strict filters
        if (cleanWord.length <= 3) return;
        if (STOPWORDS.has(cleanWord)) return;

        // Associate with each matched core
        matchedCores.forEach(core => {
          let label = 'Root';
          if (core.type === 'prefix') label = 'Prefix';
          else if (core.type === 'suffix') label = 'Suffix';

          let tooltipString = `${label}: ${core.name} (${core.meaning}`;
          if (core.origin) {
            tooltipString += `, from ${core.origin}`;
          }
          tooltipString += ')';

          if (dictionary[cleanWord]) {
            // Avoid duplicate additions of the same root/affix to the same word
            const existingRoots = dictionary[cleanWord].root.split('; ');
            if (!existingRoots.includes(core.name)) {
              dictionary[cleanWord].root += `; ${core.name}`;
              dictionary[cleanWord].meaning += `; ${core.meaning}`;
              dictionary[cleanWord].tooltip += `\n${tooltipString}`;
            }
          } else {
            dictionary[cleanWord] = {
              root: core.name,
              meaning: core.meaning,
              tooltip: tooltipString
            };
            wordCount++;
          }
        });
      });
    }
  });

  console.log(`Matched ${matchCount} etymonline entries to core roots/affixes.`);
  console.log(`Extracted and processed ${wordCount} unique words.`);

  // 3. Write highly compressed single-line JSON
  console.log(`Writing dictionary to ${outputPath} and ${outputPathPublic}...`);
  const serialized = JSON.stringify(dictionary);
  fs.writeFileSync(outputPath, serialized);
  fs.writeFileSync(outputPathPublic, serialized);
  console.log('Done! Output file size:', (fs.statSync(outputPathPublic).size / 1024).toFixed(2), 'KB');
}

main().catch(err => {
  console.error('Error running build-dict:', err);
  process.exit(1);
});
