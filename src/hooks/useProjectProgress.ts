import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type ProgressEntry = { name: string; progress: number };

// Normalize a project name for fuzzy matching between the two apps -
// lowercase, strip punctuation/extra spaces, so "Lavender Heights" and
// "lavender height" line up.
const normalize = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const useProjectProgress = () => {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-progress');

      if (fnError) throw fnError;
      if (!Array.isArray(data)) throw new Error('Unexpected response from progress function');

      setEntries(data as ProgressEntry[]);
    } catch (err) {
      console.error('Failed to load progress data', err);
      setError(err instanceof Error ? err.message : 'Failed to load progress data');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // Find the progress % for a Construction Tracker project by fuzzy-matching
  // its name against the Progress Manager project list. Names don't have to
  // match exactly - "Lavender Heights" matches "lavender height" either way.
  const getProgressForProject = (projectName: string): number | null => {
    const target = normalize(projectName);
    if (!target) return null;

    const exact = entries.find((e) => normalize(e.name) === target);
    if (exact) return exact.progress;

    const partial = entries.find((e) => {
      const candidate = normalize(e.name);
      return candidate.includes(target) || target.includes(candidate);
    });
    return partial ? partial.progress : null;
  };

  return {
    entries,
    loading,
    error,
    getProgressForProject,
    refreshProgress: fetchProgress,
  };
};
