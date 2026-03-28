/**
 * Generate Q&A pairs from text content using local Ollama (llama3.1:8b).
 */

const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODEL = 'llama3.1:8b';

/** Single Q&A pair in Alpaca format */
export type QAPair = {
  instruction: string;
  input: string;
  output: string;
};

/** The prompt template for Q&A generation */
const QA_SYSTEM_PROMPT = `You are a training data generator. Your job is to read the given text and generate structured question-answer pairs that can be used to train a large language model.

Rules:
- Read the text carefully and understand what it is about
- Generate as many question-answer pairs as possible from the content
- Each question should be something a real user would actually ask
- Each answer should come directly from the content, nothing made up
- Keep answers complete and accurate
- If the content contains code, the answer should include the full code
- If the content contains facts, the answer should state those facts clearly

Return ONLY a valid JSON array in this exact format, nothing else, no explanation, no extra text, no markdown:

[
  {
    "instruction": "write the question here",
    "input": "",
    "output": "write the complete answer here"
  }
]`;

/**
 * Check if Ollama is running and the model is available.
 */
export async function checkOllamaStatus(): Promise<{ running: boolean; modelAvailable: boolean; error?: string }> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!res.ok) return { running: false, modelAvailable: false, error: 'Ollama not responding' };
    const data = await res.json();
    const models = (data.models || []).map((m: any) => m.name);
    const modelAvailable = models.some((name: string) => name.startsWith('llama3.1'));
    return { running: true, modelAvailable, error: modelAvailable ? undefined : `Model ${MODEL} not found. Run: ollama pull ${MODEL}` };
  } catch {
    return { running: false, modelAvailable: false, error: 'Cannot connect to Ollama. Make sure it is running (ollama serve).' };
  }
}

/**
 * Split text into chunks for better Q&A quality.
 * llama3.1:8b handles ~4000 words well for Q&A generation.
 */
function chunkText(text: string, maxWords = 3000): string[] {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return [text];

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    // Add some overlap for context
    const start = Math.max(0, i - 200);
    chunks.push(words.slice(start, i + maxWords).join(' '));
  }
  return chunks;
}

/**
 * Call Ollama API to generate Q&A pairs from a text chunk.
 */
async function callOllama(textChunk: string): Promise<QAPair[]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: QA_SYSTEM_PROMPT },
        { role: 'user', content: textChunk },
      ],
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 4096,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama API error: ${response.status} — ${errText}`);
  }

  const data = await response.json();
  const content = data.message?.content || '';

  // Parse the JSON array from the response
  return parseQAPairs(content);
}

/**
 * Parse JSON Q&A pairs from LLM response, handling common formatting issues.
 */
function parseQAPairs(raw: string): QAPair[] {
  // Try to extract JSON array from the response
  let jsonStr = raw.trim();

  // Remove markdown code fences if present
  jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Find the JSON array boundaries
  const start = jsonStr.indexOf('[');
  const end = jsonStr.lastIndexOf(']');
  if (start === -1 || end === -1) {
    console.warn('Could not find JSON array in response:', raw.slice(0, 200));
    return [];
  }
  jsonStr = jsonStr.slice(start, end + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    // Validate and clean each pair
    return parsed
      .filter((item: any) => item.instruction && item.output)
      .map((item: any) => ({
        instruction: String(item.instruction).trim(),
        input: String(item.input || '').trim(),
        output: String(item.output).trim(),
      }));
  } catch (e) {
    console.warn('Failed to parse Q&A JSON:', e, '\nRaw:', jsonStr.slice(0, 300));
    return [];
  }
}

/**
 * Generate Q&A pairs from a document's text content.
 * Chunks the text and processes each chunk through Ollama.
 */
export async function generateQAPairs(
  text: string,
  sourceFile: string,
  onProgress?: (msg: string) => void,
): Promise<QAPair[]> {
  const progress = onProgress || (() => {});

  // Skip empty or placeholder content
  if (!text || text.startsWith('[') || text.length < 50) {
    progress(`Skipping ${sourceFile} — insufficient content`);
    return [];
  }

  const chunks = chunkText(text);
  const allPairs: QAPair[] = [];

  for (let i = 0; i < chunks.length; i++) {
    progress(`🧠 Processing ${sourceFile} (chunk ${i + 1}/${chunks.length})...`);
    try {
      const pairs = await callOllama(chunks[i]);
      allPairs.push(...pairs);
    } catch (err) {
      console.error(`Error processing chunk ${i + 1} of ${sourceFile}:`, err);
      progress(`⚠️ Error on ${sourceFile} chunk ${i + 1}: ${(err as Error).message}`);
    }
  }

  progress(`✅ ${sourceFile}: generated ${allPairs.length} Q&A pairs`);
  return allPairs;
}
