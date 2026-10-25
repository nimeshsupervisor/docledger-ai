'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const CHART_OF_ACCOUNTS = [
  'Revenue / Sales',
  'Advertising & Marketing',
  'Meals & Entertainment',
  'Office Supplies & Software',
  'Rent & Lease',
  'Utilities & Internet',
  'Bank Charges & Fees',
  'Payroll Expense',
  'Travel & Vehicle',
  'Owner Draws / Transfers',
  'General Expense'
];

interface Transaction {
  id: number;
  date: string;
  description: string;
  payee: string;
  category: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function UniversalStatementApp() {
  const [activeTab, setActiveTab] = useState<'upload' | 'ledger' | 'reports'>('upload');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [startingBalance, setStartingBalance] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/parse-statement', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      console.log('Extraction Result:', data);

      if (!res.ok) throw new Error(data.error || 'Extraction failed');

      if (data.starting_balance) setStartingBalance(data.starting_balance);

      const items = Array.isArray(data.transactions) ? data.transactions : [];

      const mapped: Transaction[] = items.map((t: any, idx: number) => ({
        id: idx + 1,
        date: t.date || '',
        description: t.description || '',
        payee: t.payee || 'Unassigned',
        category: t.category || (t.credit > 0 ? 'Revenue / Sales' : 'General Expense'),
        debit: typeof t.debit === 'number' ? t.debit : parseFloat(String(t.debit || 0).replace(/[^0-9.-]/g, '')) || 0,
        credit: typeof t.credit === 'number' ? t.credit : parseFloat(String(t.credit || 0).replace(/[^0-9.-]/g, '')) || 0,
        balance: typeof t.balance === 'number' ? t.balance : parseFloat(String(t.balance || 0).replace(/[^0-9.-]/g, '')) || 0,
      }));

      setTransactions(mapped);
      setIsProcessing(false);
      setActiveTab('ledger');
    } catch (err: any) {
      console.error(err);
      alert('Upload Notice: ' + err.message);
      setIsProcessing(false);
    } finally {
      // Reset input value so subsequent uploads of any file always trigger
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = (type: 'csv' | 'xlsx') => {
    if (transactions.length === 0) return;

    const rows = transactions.map((t) => ({
      'S.No': t.id,
      'Date': t.date,
      'Description': t.description,
      'Payee Name': t.payee,
      'Categorized Account': t.category,
      'Debit ($)': t.debit > 0 ? t.debit.toFixed(2) : '',
      'Credit ($)': t.credit > 0 ? t.credit.toFixed(2) : '',
      'Balance ($)': t.balance > 0 ? t.balance.toFixed(2) : ''
    }));

    if (type === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
      XLSX.writeFile(wb, `${fileName.replace(/\.[^/.]+$/, '')}_Hubdoc.xlsx`);
    } else {
      const csv = Papa.unparse(rows);
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName.replace(/\.[^/.]+$/, '')}_Hubdoc.csv`;
      link.click();
    }
  };

  const reports = useMemo(() => {
    let totalRevenue = 0;
    const expensesByCategory: Record<string, number> = {};
    let totalExpenses = 0;
    let ownerDraws = 0;
    let totalWithdrawals = 0;
    let totalDeposits = 0;

    transactions.forEach((t) => {
      totalWithdrawals += t.debit;
      totalDeposits += t.credit;

      if (t.category === 'Revenue / Sales') {
        totalRevenue += t.credit;
      } else if (t.category === 'Owner Draws / Transfers') {
        ownerDraws += t.debit;
      } else if (t.debit > 0) {
        expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.debit;
        totalExpenses += t.debit;
      }
    });

    const netOperatingIncome = totalRevenue - totalExpenses;
    const closingBalance = startingBalance
      ? startingBalance + totalDeposits - totalWithdrawals
      : transactions.length > 0
      ? transactions[transactions.length - 1].balance
      : 0;

    return {
      totalRevenue,
      expensesByCategory,
      totalExpenses,
      netOperatingIncome,
      ownerDraws,
      totalWithdrawals,
      totalDeposits,
      closingBalance
    };
  }, [transactions, startingBalance]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            HQ
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900">Universal DocLedger AI</h1>
            <p className="text-xs text-slate-500">Universal Hubdoc Parser (PDF, JPG, PNG) + QBO Ledger</p>
          </div>
        </div>

        <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'upload' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Upload Document
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'ledger' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Categorized Ledger ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'reports' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
          >
            QBO Reports
          </button>
        </nav>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto mt-12">
            <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white rounded-2xl p-12 text-center transition cursor-pointer relative shadow-sm">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
              />
              <Upload className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-1">Upload Any Statement or Photo</h3>
              <p className="text-sm text-slate-500 mb-5">Supports PDF statements, scanned documents, camera photos, or receipts</p>
              <span className="inline-block px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold shadow hover:bg-indigo-700 transition">
                {isProcessing ? 'Extracting transactions...' : 'Select File to Extract'}
              </span>
            </div>
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Extracted & Categorized Transactions</h2>
                <p className="text-xs text-slate-500">Source: {fileName} | Extracted Items: {transactions.length}</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="flex items-center space-x-1.5 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm font-medium hover:bg-slate-50 text-slate-700 shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" /> <span>Upload Another</span>
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="flex items-center space-x-1.5 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm font-medium hover:bg-slate-50 text-slate-700 shadow-sm"
                >
                  <Download className="w-4 h-4" /> <span>Export CSV (BOM)</span>
                </button>
                <button
                  onClick={() => handleExport('xlsx')}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" /> <span>Export Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">S.No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Payee Name</th>
                    <th className="py-3 px-4">Categorized Account</th>
                    <th className="py-3 px-4 text-right">Debit ($)</th>
                    <th className="py-3 px-4 text-right">Credit ($)</th>
                    <th className="py-3 px-4 text-right">Balance ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx, idx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-slate-400 font-mono text-xs">{tx.id}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">{tx.date}</td>
                      <td className="py-3 px-4 text-slate-800 font-medium">{tx.description}</td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={tx.payee}
                          onChange={(e) => {
                            const updated = [...transactions];
                            updated[idx].payee = e.target.value;
                            setTransactions(updated);
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none w-full bg-slate-50 focus:bg-white"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={tx.category}
                          onChange={(e) => {
                            const updated = [...transactions];
                            updated[idx].category = e.target.value;
                            setTransactions(updated);
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-700 outline-none w-full"
                        >
                          {CHART_OF_ACCOUNTS.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-rose-600">
                        {tx.debit > 0 ? `$${tx.debit.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-emerald-600">
                        {tx.credit > 0 ? `$${tx.credit.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                        {tx.balance > 0 ? `$${tx.balance.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">QuickBooks Online Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-base text-slate-900">Profit & Loss (Income Statement)</h3>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">Accrual Basis</span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-sm font-semibold text-slate-800">
                    <span>Operating Revenue / Income</span>
                    <span className="text-emerald-600 font-mono">${reports.totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Operating Expenses</p>
                    {Object.entries(reports.expensesByCategory).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between text-xs py-1 text-slate-600">
                        <span>{cat}</span>
                        <span className="font-mono">${amt.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold text-slate-800 pt-2 border-t border-slate-100">
                      <span>Total Operating Expenses</span>
                      <span className="text-rose-600 font-mono">${reports.totalExpenses.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t-2 border-slate-200 flex justify-between text-base font-bold text-slate-900">
                    <span>Net Operating Income</span>
                    <span className={reports.netOperatingIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      ${reports.netOperatingIncome.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-base text-slate-900">Balance Sheet Summary</h3>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-semibold">Reconciled Cash</span>
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Assets</p>
                    {startingBalance > 0 && (
                      <div className="flex justify-between text-xs py-1 text-slate-600">
                        <span>Starting Cash Balance</span>
                        <span className="font-mono">${startingBalance.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs py-1 text-slate-600">
                      <span>Total Bank Deposits (+)</span>
                      <span className="font-mono text-emerald-600">+${reports.totalDeposits.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs py-1 text-slate-600">
                      <span>Total Bank Withdrawals (-)</span>
                      <span className="font-mono text-rose-600">-${reports.totalWithdrawals.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-slate-800 pt-2 border-t border-slate-100">
                      <span>Ending Bank Account (Cash)</span>
                      <span className="font-mono font-bold">${reports.closingBalance.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}