import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Tested stable models ordered by availability
const MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
];

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Extract all transaction rows from this bank statement into valid JSON:
{
  "starting_balance": 0.00,
  "closing_balance": 0.00,
  "transactions": [
    {
      "date": "MMM DD",
      "description": "Clean description",
      "payee": "Merchant or Entity Name",
      "category": "General Expense",
      "debit": 0.00,
      "credit": 0.00,
      "balance": 0.00
    }
  ]
}
Return valid JSON only.`;

    let lastError: any = null;

    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
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

        if (response.text) {
          let text = response.text.trim();
          if (text.startsWith('```')) {
            text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          }
          const parsed = JSON.parse(text);
          return NextResponse.json(parsed);
        }
      } catch (err: any) {
        lastError = err;
        // Pause 1 second before trying next model
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw lastError || new Error('Google Gemini models are temporarily busy. Please retry in 1 minute.');
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Document extraction failed.' },
      { status: 500 }
    );
  }
}