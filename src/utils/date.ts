// Show dates as DD/MM/YYYY everywhere in the app.
// Plain "YYYY-MM-DD" values (expense/payment dates) are read as-is so the day
// never shifts because of time zones.
export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};
