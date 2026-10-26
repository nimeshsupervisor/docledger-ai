'use client';

import React, { useState } from 'react';
import { UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';

interface Transaction {
  date: string;
  description: string;
  payee: string;
  category: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function DocLedgerApp() {
  const [activeTab, setActiveTab] = useState<'upload' | 'ledger' | 'reports'>('upload');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [startingBalance, setStartingBalance] = useState<number>(0);
  const [closingBalance, setClosingBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setStatusText('Sending file to Render OCR engine...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('https://docledger-backend.onrender.com/api/extract', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Backend extraction error');
      }

      setTransactions(data.transactions || []);
      if (typeof data.starting_balance === 'number') setStartingBalance(data.starting_balance);
      if (typeof data.closing_balance === 'number') setClosingBalance(data.closing_balance);
      
      setStatusText(null);
      setActiveTab('ledger');
    } catch (err: any) {
      console.error(err);
      setStatusText('Extraction Failed: ' + (err.message || 'Check network connection'));
    } finally {
      setIsExtracting(false);
      event.target.value = '';
    }
  };

  const totalCredits = transactions.reduce((acc, tx) => acc + (tx.credit || 0), 0);
  const totalDebits = transactions.reduce((acc, tx) => acc + (tx.debit || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
            HQ
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Universal DocLedger AI</h1>
            <p className="text-xs text-slate-500 font-medium">Render OCR Engine Active</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                activeTab === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upload Document
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                activeTab === 'ledger' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Categorized Ledger ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                activeTab === 'reports' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              QBO Reports
            </button>
          </nav>

          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {statusText && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-sm ${
            statusText.includes('Failed') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            <span>{statusText}</span>
            <button onClick={() => setStatusText(null)} className="font-bold ml-4 text-base">x</button>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="bg-white border-2 border-dashed border-blue-200 rounded-3xl p-12 text-center shadow-sm max-w-2xl mx-auto my-12">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Upload Bank Statement</h2>
            <p className="text-sm text-slate-500 mb-6">Processes on your dedicated Render OCR Engine</p>

            <label
              className={`inline-block px-8 py-3 rounded-xl font-bold text-white transition shadow-md cursor-pointer ${
                isExtracting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isExtracting ? 'Extracting transactions...' : 'Select File to Convert'}
              <input
                type="file"
                className="hidden"
                accept="application/pdf,image/png,image/jpeg,image/jpg"
                disabled={isExtracting}
                onChange={handleFileUpload}
              />
            </label>
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Statement Transactions</h2>
                <p className="text-xs text-slate-500">Auto-extracted line items</p>
              </div>
              <div className="flex space-x-6 text-sm font-semibold">
                <span className="text-slate-600">Starting: ${startingBalance.toFixed(2)}</span>
                <span className="text-emerald-600">Total Credits: +${totalCredits.toFixed(2)}</span>
                <span className="text-rose-600">Total Debits: -${totalDebits.toFixed(2)}</span>
                <span className="text-blue-600">Closing: ${closingBalance.toFixed(2)}</span>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <p>No transactions extracted yet. Upload a document to start.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold border-b">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Payee</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Debit</th>
                      <th className="py-3 px-4 text-right">Credit</th>
                      <th className="py-3 px-4 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">{tx.date}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{tx.payee || '-'}</td>
                        <td className="py-3 px-4 text-slate-600">{tx.description}</td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                            {tx.category || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-rose-600">
                          {tx.debit > 0 ? '$' + tx.debit.toFixed(2) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-600">
                          {tx.credit > 0 ? '$' + tx.credit.toFixed(2) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-800">
                          {tx.balance ? '$' + tx.balance.toFixed(2) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4">Summary Breakdown</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-slate-600">Total Inflow (Deposits)</span>
                  <span className="font-semibold text-emerald-600">+${totalCredits.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-slate-600">Total Outflow (Expenses)</span>
                  <span className="font-semibold text-rose-600">-${totalDebits.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 pt-4">
                  <span className="font-bold text-slate-800">Net Cash Flow</span>
                  <span className={`font-bold ${totalCredits - totalDebits >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ${(totalCredits - totalDebits).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4">Export Options</h3>
              <p className="text-xs text-slate-500 mb-6">Download transactions formatted for accounting.</p>
              <button
                onClick={() => {
                  const headers = "Date,Payee,Description,Category,Debit,Credit,Balance\n";
                  const rows = transactions.map(t => '"' + t.date + '","' + t.payee + '","' + t.description + '","' + t.category + '",' + t.debit + ',' + t.credit + ',' + t.balance).join("\n");
                  const blob = new Blob([headers + rows], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'docledger_transactions.csv';
                  a.click();
                }}
                disabled={transactions.length === 0}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition shadow-sm"
              >
                Download CSV for QuickBooks / Excel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}