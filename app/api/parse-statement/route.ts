import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Active models recognized by your API key version
const ACTIVE_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.8-flash'
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTransactionsSafely(rawText: string) {
  let cleaned = rawText.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  try {
    const direct = JSON.parse(cleaned);
    if (direct.transactions && Array.isArray(direct.transactions)) return direct;
    if (Array.isArray(direct)) return { transactions: direct };
  } catch {
    // Continue to snippet extraction
  }

  const txMatch = cleaned.match(/"transactions"\s*:\s*\[([\s\S]*)/);
  const jsonContent = txMatch ? txMatch[1] : (cleaned.startsWith('[') ? cleaned.slice(1) : cleaned);

  const recoveredItems: any[] = [];
  const objRegex = /\{[^{}]*"date"[^{}]*"description"[^{}]*\}/g;
  let match;

  while ((match = objRegex.exec(jsonContent)) !== null) {
    try {
      const item = JSON.parse(match[0]);
      recoveredItems.push(item);
    } catch {
      // ignore partial
    }
  }

  if (recoveredItems.length > 0) {
    const startMatch = cleaned.match(/"starting_balance"\s*:\s*([0-9.-]+)/);
    const closeMatch = cleaned.match(/"closing_balance"\s*:\s*([0-9.-]+)/);

    return {
      starting_balance: startMatch ? parseFloat(startMatch[1]) : 0,
      closing_balance: closeMatch ? parseFloat(closeMatch[1]) : 0,
      transactions: recoveredItems
    };
  }

  throw new Error('Could not parse statement lines. Please ensure document is legible.');
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not defined in .env.local' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');
    const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const prompt = `
Extract every transaction line item from this bank statement into compact JSON format:
{
  "starting_balance": 0.00,
  "closing_balance": 0.00,
  "transactions": [
    {
      "date": "MMM DD",
      "description": "Short clean description",
      "payee": "Merchant or Entity Name",
      "category": "Revenue / Sales OR General Expense OR Travel & Vehicle OR Meals & Entertainment OR Utilities & Internet OR Bank Charges & Fees OR Owner Draws / Transfers",
      "debit": 0.00,
      "credit": 0.00,
      "balance": 0.00
    }
  ]
}
Rules:
1. Return pure JSON only.
2. If withdrawal, debit > 0 and credit = 0. If deposit, credit > 0 and debit = 0.
3. Clean merchant payee names.
`;

    let lastError: any = null;

    for (const modelName of ACTIVE_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`Processing with ${modelName} (attempt ${attempt})...`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      data: base64Data,
                      mimeType: mimeType
                    }
                  },
                  { text: prompt }
                ]
              }
            ],
            config: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          });

          if (response.text) {
            const parsed = extractTransactionsSafely(response.text);
            console.log(`Successfully parsed with ${modelName}`);
            return NextResponse.json(parsed);
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`${modelName} warning:`, err.message || err);
          if (err?.message?.includes('503') || err?.status === 503) {
            await sleep(2000);
          }
        }
      }
    }

    throw lastError || new Error('Service busy. Please try again.');
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process document' }, { status: 500 });
  }
}