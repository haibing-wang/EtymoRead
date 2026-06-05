export interface Affix {
  id: number;
  affix: string;
  meaning: string;
  examples: string;
  type: "prefix" | "suffix";
}

export interface WordRoot {
  id: number;
  root: string;
  meaning: string;
  origin: "Greek" | "Latin";
  examples: string;
}

export interface MatchResult {
  word: string;
  matchedPrefixes: Affix[];
  matchedSuffixes: Affix[];
  matchedRoots: WordRoot[];
  explanation: string;
}

interface NormalizedAffix {
  original: Affix;
  cleanAffix: string;
  length: number;
}

interface NormalizedRoot {
  original: WordRoot;
  cleanRoots: string[];
}

export interface DictEntry {
  root: string;
  meaning: string;
  tooltip: string;
}

let normalizedPrefixes: NormalizedAffix[] = [];
let normalizedSuffixes: NormalizedAffix[] = [];
let normalizedRoots: NormalizedRoot[] = [];
let etymoDictionary: Record<string, DictEntry> = {};
let matchingMode: 'dict' | 'algorithm' = 'dict';
let isInitialized = false;
let initPromise: Promise<void> | null = null;

export function setMatchingMode(mode: 'dict' | 'algorithm') {
  matchingMode = mode;
  console.log(`Matching mode set to: ${mode}`);
}

/**
 * Asynchronously loads the JSON databases from the extension package
 * and normalizes the data in memory.
 */
export function initializeDatabase(): Promise<void> {
  if (isInitialized) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const affixesUrl = chrome.runtime.getURL('affixes.json');
      const wordRootsUrl = chrome.runtime.getURL('wordRoots.json');
      const dictUrl = chrome.runtime.getURL('etymo-dictionary.json');

      const [affixesRes, wordRootsRes, dictRes, storageRes] = await Promise.all([
        fetch(affixesUrl),
        fetch(wordRootsUrl),
        fetch(dictUrl),
        new Promise<{ matchingMode?: 'dict' | 'algorithm' }>((resolve) => {
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['matchingMode'], (res) => resolve(res));
          } else {
            resolve({});
          }
        })
      ]);

      const affixesData: Affix[] = await affixesRes.json();
      const wordRootsData: WordRoot[] = await wordRootsRes.json();
      etymoDictionary = await dictRes.json();
      matchingMode = storageRes.matchingMode || 'dict';

      // Process affixes
      affixesData.forEach(item => {
        const rawPatterns = item.affix.split(/[\/,()]+/);
        rawPatterns.forEach(pattern => {
          const clean = pattern.replace(/^-|-$/g, '').trim().toLowerCase();
          if (!clean) return;

          const norm: NormalizedAffix = {
            original: item,
            cleanAffix: clean,
            length: clean.length
          };

          if (item.type === 'prefix') {
            normalizedPrefixes.push(norm);
          } else {
            normalizedSuffixes.push(norm);
          }
        });
      });

      // Sort by length descending
      normalizedPrefixes.sort((a, b) => b.length - a.length);
      normalizedSuffixes.sort((a, b) => b.length - a.length);

      // Process word roots
      wordRootsData.forEach(item => {
        const rawPatterns = item.root.split(/[\/,]+/);
        const cleanRoots = rawPatterns
          .map(p => p.trim().toLowerCase())
          .filter(p => p.length > 0);

        if (cleanRoots.length > 0) {
          normalizedRoots.push({
            original: item,
            cleanRoots
          });
        }
      });

      isInitialized = true;
      console.log('EtymoRead local databases and dictionary loaded. Mode:', matchingMode);
    } catch (err) {
      console.error('Failed to initialize EtymoRead databases:', err);
      initPromise = null; // Allow retry on failure
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Checks if the database has completed initialization.
 */
export function isDatabaseReady(): boolean {
  return isInitialized;
}

// Common English stopwords (filtered during word scanning)
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

/**
 * Checks if a word matches any etymological root or affix.
 * Returns null if no significant etymological matches are found.
 * Note: Assumes initializeDatabase() has completed.
 */
export function matchLocalEtymology(word: string, forceAlgorithm = false): MatchResult | null {
  if (!isInitialized) {
    return null;
  }

  const cleanWord = word.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (cleanWord.length <= 3) return null;
  if (STOPWORDS.has(cleanWord)) return null;

  // 1. Mode 1: Selected Dictionary Mode (Default, unless forced to algorithm)
  if (matchingMode === 'dict' && !forceAlgorithm) {
    const dictEntry = etymoDictionary[cleanWord];
    if (!dictEntry) {
      return null;
    }

    const matchedPrefixes: Affix[] = [];
    const matchedSuffixes: Affix[] = [];
    const matchedRoots: WordRoot[] = [];

    const lines = dictEntry.tooltip.split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/^(Prefix|Suffix|Root):\s*([^(]+)\s*\(([^)]+)\)$/);
      if (match) {
        const [_, type, rootOrAffix, meaningAndOrigin] = match;
        const cleanRootOrAffix = rootOrAffix.trim();

        if (type === 'Prefix') {
          matchedPrefixes.push({
            id: index + 10000,
            affix: cleanRootOrAffix,
            meaning: meaningAndOrigin.trim(),
            examples: '',
            type: 'prefix'
          });
        } else if (type === 'Suffix') {
          matchedSuffixes.push({
            id: index + 20000,
            affix: cleanRootOrAffix,
            meaning: meaningAndOrigin.trim(),
            examples: '',
            type: 'suffix'
          });
        } else if (type === 'Root') {
          let meaning = meaningAndOrigin;
          let origin: any = 'Latin';
          const originMatch = meaningAndOrigin.match(/(.+),\s*from\s+(Greek|Latin)/i);
          if (originMatch) {
            meaning = originMatch[1].trim();
            origin = originMatch[2].trim();
          }

          matchedRoots.push({
            id: index + 30000,
            root: cleanRootOrAffix,
            meaning: meaning,
            origin: origin,
            examples: ''
          });
        }
      }
    });

    return {
      word: cleanWord,
      matchedPrefixes,
      matchedSuffixes,
      matchedRoots,
      explanation: dictEntry.tooltip
    };
  }

  // 2. Mode 2: Aggressive Algorithm Mode (or forceAlgorithm is true)
  let matchedPrefixes: Affix[] = [];
  let matchedSuffixes: Affix[] = [];
  let matchedRoots: WordRoot[] = [];

  let stem = cleanWord;

  // 1. Try to peel off prefixes (up to 2 prefixes)
  for (let step = 0; step < 2; step++) {
    const foundPrefix = normalizedPrefixes.find(p => 
      stem.startsWith(p.cleanAffix) && stem.length - p.cleanAffix.length >= 3
    );
    if (foundPrefix) {
      if (!matchedPrefixes.some(p => p.id === foundPrefix.original.id)) {
        matchedPrefixes.push(foundPrefix.original);
      }
      stem = stem.slice(foundPrefix.cleanAffix.length);
    } else {
      break;
    }
  }

  // 2. Try to peel off suffixes (up to 2 suffixes)
  for (let step = 0; step < 2; step++) {
    const foundSuffix = normalizedSuffixes.find(s => 
      stem.endsWith(s.cleanAffix) && stem.length - s.cleanAffix.length >= 3
    );
    if (foundSuffix) {
      if (!matchedSuffixes.some(s => s.id === foundSuffix.original.id)) {
        matchedSuffixes.push(foundSuffix.original);
      }
      stem = stem.slice(0, stem.length - foundSuffix.cleanAffix.length);
    } else {
      break;
    }
  }

  // 3. Search for matching roots in the remaining stem
  const findRootInText = (text: string): WordRoot[] => {
    const matches: WordRoot[] = [];
    normalizedRoots.forEach(nr => {
      const match = nr.cleanRoots.some(r => {
        if (r.length <= 2) {
          return text === r;
        }
        return text.includes(r);
      });
      if (match) {
        matches.push(nr.original);
      }
    });
    return matches;
  };

  matchedRoots = findRootInText(stem);
  
  if (matchedRoots.length === 0 && stem !== cleanWord) {
    matchedRoots = findRootInText(cleanWord);
  }

  // Validity Check: Must peel off a prefix/suffix, AND have a matched root
  const hasAffix = matchedPrefixes.length > 0 || matchedSuffixes.length > 0;
  const hasRoot = matchedRoots.length > 0;
  if (!hasAffix || !hasRoot) {
    return null;
  }

  // Build the local breakdown explanation text
  let explanationParts: string[] = [];

  if (matchedPrefixes.length > 0) {
    explanationParts.push(
      `Prefix: ${matchedPrefixes.map(p => `${p.affix} (${p.meaning})`).join(', ')}`
    );
  }
  if (matchedRoots.length > 0) {
    explanationParts.push(
      `Root: ${matchedRoots.map(r => `${r.root} (${r.meaning}, from ${r.origin})`).join(', ')}`
    );
  }
  if (matchedSuffixes.length > 0) {
    explanationParts.push(
      `Suffix: ${matchedSuffixes.map(s => `${s.affix} (${s.meaning})`).join(', ')}`
    );
  }

  if (matchedRoots.length > 0) {
    const rootExamples = matchedRoots[0].examples;
    if (rootExamples) {
      explanationParts.push(`Examples: ${rootExamples}`);
    }
  }

  const explanation = explanationParts.join('\n');

  return {
    word: cleanWord,
    matchedPrefixes,
    matchedSuffixes,
    matchedRoots,
    explanation
  };
}
