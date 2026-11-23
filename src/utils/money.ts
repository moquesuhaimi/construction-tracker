// Ringgit formatting used across the app, e.g. RM1,234.50
export const formatRM = (value: number): string =>
  `RM${(Number.isFinite(value) ? value : 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
