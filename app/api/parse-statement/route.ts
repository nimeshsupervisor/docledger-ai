import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function parseStatementResponse(rawText: string) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  try {
    const direct = JSON.parse(cleaned);
    if (direct.transactions && Array.isArray(direct.transactions)) return direct;
    if (Array.isArray(direct)) return { starting_balance: 0, closing_balance: 0, transactions: direct };
  } catch {
    // Continue to regex recovery
  }

  const txMatch = cleaned.match(/"transactions"\s*:\s*\[([\s\S]*)/);
  const jsonContent = txMatch ? txMatch[1] : (cleaned.startsWith('[') ? cleaned.slice(1) : cleaned);

  const transactions: any[] = [];
  const objRegex = /\{[^{}]*"date"[^{}]*"description"[^{}]*\}/g;
  let match;

  while ((match = objRegex.exec(jsonContent)) !== null) {
    try {
      transactions.push(JSON.parse(match[0]));
    } catch {
      // Skip partial row
    }
  }

  if (transactions.length > 0) {
    const startMatch = cleaned.match(/"starting_balance"\s*:\s*([0-9.-]+)/);
    const closeMatch = cleaned.match(/"closing_balance"\s*:\s*([0-9.-]+)/);
    return {
      starting_balance: startMatch ? parseFloat(startMatch[1]) : 0,
      closing_balance: closeMatch ? parseFloat(closeMatch[1]) : 0,
      transactions
    };
  }

  throw new Error('Unable to extract statement rows. Please check document clarity.');
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in environment variables.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No document file provided.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Extract all transaction line items from this bank statement into valid JSON:
{
  "starting_balance": 0.00,
  "closing_balance": 0.00,
  "transactions": [
    {
      "date": "MMM DD",
      "description": "Clean description",
      "payee": "Merchant or Entity Name",
      "category": "Revenue / Sales OR General Expense OR Travel & Vehicle OR Meals & Entertainment OR Utilities & Internet OR Bank Charges & Fees OR Owner Draws / Transfers",
      "debit": 0.00,
      "credit": 0.00,
      "balance": 0.00
    }
  ]
}
Return pure JSON only. Debit > 0 for withdrawals/money out, Credit > 0 for deposits/money in.`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    const outputText = response.text || '';
    const parsed = parseStatementResponse(outputText);
    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Server error during parse:', error);
    return NextResponse.json(
      { error: error?.message || 'Document extraction failed.' },
      { status: 500 }
    );
  }
}