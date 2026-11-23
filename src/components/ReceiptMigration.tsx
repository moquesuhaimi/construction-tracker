import React, { useCallback, useEffect, useState } from 'react';
import { HardDriveUpload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadReceiptDataUrl } from '../lib/receipts';
import { useAuth } from '../hooks/useAuth';

// One-time admin tool: moves receipt photos that are still stored as base64
// text inside the expenses table into the "receipts" Storage bucket, and
// replaces the column value with a short pointer. Rows are processed one at
// a time so a phone never has to hold more than one photo in memory.
// Safe to stop and run again: it only picks rows that still start with "data:".

export const ReceiptMigration: React.FC = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const countRemaining = useCallback(async () => {
    const { count, error } = await supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .like('receipt_image', 'data:%');
    if (error) {
      setMessage(`Could not count receipts: ${error.message}`);
      return;
    }
    setRemaining(count ?? 0);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      const admin = !!(data as { is_admin?: boolean } | null)?.is_admin;
      setIsAdmin(admin);
      if (admin) countRemaining();
    })();
  }, [user, countRemaining]);

  const run = async () => {
    setRunning(true);
    setMessage(null);
    setDone(0);
    setFailed([]);
    const skip = new Set<string>();

    try {
      while (true) {
        let query = supabase
          .from('expenses')
          .select('id, project_id, receipt_image')
          .like('receipt_image', 'data:%')
          .order('id')
          .limit(1);
        if (skip.size) query = query.not('id', 'in', `(${[...skip].join(',')})`);

        const { data, error } = await query;
        if (error) throw error;
        const row = (data as { id: string; project_id: string; receipt_image: string }[] | null)?.[0];
        if (!row) break;

        try {
          const pointer = await uploadReceiptDataUrl(row.project_id, row.receipt_image);
          const { error: updateError } = await supabase
            .from('expenses')
            .update({ receipt_image: pointer })
            .eq('id', row.id)
            .like('receipt_image', 'data:%');
          if (updateError) throw updateError;
          setDone((n) => n + 1);
          setRemaining((n) => (n === null ? n : Math.max(0, n - 1)));
        } catch (err) {
          console.error('Receipt move failed for', row.id, err);
          skip.add(row.id);
          setFailed((list) => [...list, row.id]);
        }
      }
      setMessage('Finished.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setRunning(false);
      countRemaining();
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
      <h3 className="text-base lg:text-lg font-semibold text-white mb-2 flex items-center gap-2">
        <HardDriveUpload className="h-5 w-5 text-yellow-400" />
        Receipt Storage (Admin)
      </h3>
      <p className="text-xs lg:text-sm text-gray-400 mb-4">
        Moves old receipt photos out of the database into file storage, so the database stays small.
        New receipts already go to file storage. You can stop and run this again at any time.
      </p>

      <div className="text-sm text-white mb-4">
        {remaining === null ? (
          <span className="text-gray-400">Checking…</span>
        ) : remaining === 0 ? (
          <span className="flex items-center gap-2 text-green-400">
            <CheckCircle2 className="h-4 w-4" /> All receipts are in file storage.
          </span>
        ) : (
          <span>
            <span className="font-semibold text-yellow-400">{remaining}</span> receipt
            {remaining === 1 ? '' : 's'} still inside the database.
          </span>
        )}
        {(running || done > 0) && <div className="mt-1 text-gray-300">Moved this run: {done}</div>}
        {failed.length > 0 && (
          <div className="mt-1 flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-4 w-4" /> {failed.length} failed (left unchanged, see console).
          </div>
        )}
        {message && <div className="mt-1 text-gray-400">{message}</div>}
      </div>

      <button
        onClick={run}
        disabled={running || !remaining}
        className="flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black px-4 py-3 rounded-lg font-medium transition-colors text-sm lg:text-base"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDriveUpload className="h-4 w-4" />}
        {running ? 'Moving receipts…' : 'Move receipts to Storage'}
      </button>
    </div>
  );
};
