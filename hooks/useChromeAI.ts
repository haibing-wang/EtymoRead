import { useState, useEffect } from 'react';

export interface AIAvailability {
  available: 'yes' | 'no' | 'after-download' | 'readily';
  apiType: 'languageModel' | 'assistant' | 'none';
}

/**
 * Checks the availability of window.ai / Gemini Nano in the browser.
 */
export async function checkAIAvailability(): Promise<AIAvailability> {
  const anyWin = window as any;
  const ai = anyWin.ai;

  if (!ai) {
    return { available: 'no', apiType: 'none' };
  }

  try {
    if (ai.languageModel) {
      const caps = await ai.languageModel.capabilities();
      return { available: caps.available, apiType: 'languageModel' };
    } else if (ai.assistant) {
      const caps = await ai.assistant.capabilities();
      return { available: caps.available, apiType: 'assistant' };
    }
  } catch (e) {
    console.error('Error checking Chrome AI capabilities:', e);
  }

  return { available: 'no', apiType: 'none' };
}

/**
 * Analyzes a word using Chrome's window.ai (Gemini Nano).
 * Supports standard async/await return as well as streaming chunks.
 */
export async function analyzeWord(
  word: string,
  context?: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const status = await checkAIAvailability();
  const isReady = status.available === 'yes' || status.available === 'readily';
  if (!isReady) {
    throw new Error('Local Chrome AI (Gemini Nano) is not supported or fully downloaded on this browser.');
  }

  const anyWin = window as any;
  const ai = anyWin.ai;

  const systemPrompt = 
    `You are an etymology expert. Analyze the English word provided. ` +
    `If the word is a basic, underived high-frequency word (such as pronouns, simple verbs like 'go/do/make/be', articles, prepositions, or simple words that cannot be logically deconstructed into a prefix/suffix and root), ` +
    `you MUST respond with exactly the token: UNABLE_TO_DECONSTRUCT. Do not explain or format anything else. ` +
    `Otherwise, deconstruct the word into its prefix, root, and suffix if applicable. ` +
    `Explain the origin (Latin/Greek/etc.) and meaning in English. ` +
    `Format the output cleanly in English. Keep the response very concise (under 120 words). ` +
    `Format like this:\n` +
    `[Roots/Affixes] ...\n` +
    `[Etymology & Meaning] ...`;

  const userPrompt = context 
    ? `Please analyze the word "${word}" in the context of the sentence: "${context}"`
    : `Please analyze the word "${word}".`;

  let session: any = null;

  try {
    if (status.apiType === 'languageModel') {
      session = await ai.languageModel.create({
        systemPrompt: systemPrompt,
        temperature: 0.1,
      });
    } else if (status.apiType === 'assistant') {
      session = await ai.assistant.create({
        systemPrompt: systemPrompt,
        temperature: 0.1,
      });
    }

    if (!session) {
      throw new Error('Failed to create Chrome AI session.');
    }

    const REFUSAL_TOKEN = 'UNABLE_TO_DECONSTRUCT';
    const FRIENDLY_REFUSAL = 'This is a basic or high-frequency word that cannot be logically deconstructed.';

    if (onChunk) {
      // Streaming support
      let fullText = '';
      if (session.promptStreaming) {
        const stream = session.promptStreaming(userPrompt);
        for await (const chunk of stream) {
          fullText = chunk;
          const trimmed = chunk.trim();
          if (trimmed === REFUSAL_TOKEN) {
            onChunk(FRIENDLY_REFUSAL);
          } else {
            onChunk(chunk);
          }
        }
      } else {
        const result = await session.prompt(userPrompt);
        fullText = result;
        const trimmed = result.trim();
        if (trimmed === REFUSAL_TOKEN) {
          onChunk(FRIENDLY_REFUSAL);
        } else {
          onChunk(result);
        }
      }
      return fullText.trim() === REFUSAL_TOKEN ? FRIENDLY_REFUSAL : fullText;
    } else {
      // Promise-based standard response
      const result = await session.prompt(userPrompt);
      return result.trim() === REFUSAL_TOKEN ? FRIENDLY_REFUSAL : result;
    }
  } catch (error: any) {
    console.error('Error during word analysis with Chrome AI:', error);
    throw error;
  } finally {
    if (session && typeof session.destroy === 'function') {
      try {
        session.destroy();
      } catch (err) {
        // ignore session cleanup errors
      }
    }
  }
}

/**
 * React hook to manage Chrome AI settings and availability state.
 */
export function useChromeAI() {
  const [availability, setAvailability] = useState<AIAvailability>({
    available: 'no',
    apiType: 'none',
  });
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function init() {
      const status = await checkAIAvailability();
      setAvailability(status);

      // Retrieve state from chrome storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['aiEnabled'], (res) => {
          setIsEnabled(!!res.aiEnabled);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  const toggleAI = (val: boolean) => {
    setIsEnabled(val);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ aiEnabled: val });
    }
  };

  return {
    availability,
    isEnabled,
    toggleAI,
    loading,
    analyzeWord,
  };
}
