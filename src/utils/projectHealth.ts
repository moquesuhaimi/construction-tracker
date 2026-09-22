// Project Health System
//
// Calculates an automatic, non-manual RAG (red/amber/green) health status for a
// project from its own data - schedule dates, spend, subcontractor commitments,
// site progress % and payments received. The user can never manually override
// the Overall status; it is always derived.
//
// This is a "Time-Based Schedule Health" - a simple elapsed-time vs progress
// comparison, NOT formal CPM/EVM. The calculateSchedule() function is isolated
// so a future Baseline Schedule / EVM module can replace it without touching
// the rest of the health system.

export type RagStatus = 'healthy' | 'watch' | 'at_risk' | 'critical' | 'insufficient_data';

export interface ParamHealth {
  status: RagStatus;
  label: string;
  detail: string;
}

export interface SubcontractorFinancials {
  contractValue: number;
  paid: number;
}

export interface ProjectHealthInput {
  budget: number;
  totalSpent: number;
  startDate?: string | null;
  endDate?: string | null;
  siteProgressPct: number | null;
  received: number;
  subcontractors: SubcontractorFinancials[];
}

export interface ProjectHealthResult {
  overall: RagStatus;
  schedule: ParamHealth;
  cost: ParamHealth;
  cashflow: ParamHealth;
  progress: ParamHealth;
  profitability: ParamHealth;
  commitments: ParamHealth;
  riskIssues: ParamHealth;
  score: number | null;
  explanation: string;
}

export const RAG_LABEL: Record<RagStatus, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  at_risk: 'At risk',
  critical: 'Critical',
  insufficient_data: 'Insufficient data',
};

// RAG severity order, worst last - used for the worst-condition Overall rule.
const SEVERITY: RagStatus[] = ['healthy', 'watch', 'at_risk', 'critical'];

const worstOf = (a: RagStatus, b: RagStatus): RagStatus => {
  if (a === 'insufficient_data') return b === 'insufficient_data' ? a : b;
  if (b === 'insufficient_data') return a;
  return SEVERITY.indexOf(a) >= SEVERITY.indexOf(b) ? a : b;
};

// Milestone-based payment terms (Acceptance 10%, Mobilisation 25%, then 20%
// per progress claim at ~35/65/90% completion, 5% on final completion).
// This is a default template - if different clients use different terms,
// this table is the one place to make that configurable later.
const PAYMENT_MILESTONES: { atProgress: number; cumulativeClaimable: number }[] = [
  { atProgress: 0, cumulativeClaimable: 0.35 },
  { atProgress: 35, cumulativeClaimable: 0.55 },
  { atProgress: 65, cumulativeClaimable: 0.75 },
  { atProgress: 90, cumulativeClaimable: 0.95 },
  { atProgress: 100, cumulativeClaimable: 1.0 },
];

const getClaimableFraction = (progressPct: number): number => {
  let claimable = 0.35;
  for (const step of PAYMENT_MILESTONES) {
    if (progressPct >= step.atProgress) claimable = step.cumulativeClaimable;
  }
  return claimable;
};

const fmt = (n: number): string =>
  `$${Math.round(n).toLocaleString()}`;

// A. Schedule Health (section 2) - Time-Based Schedule Health, not CPM/EVM.
const calculateSchedule = (
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  actualProgressPct: number | null
): { schedule: ParamHealth; expectedProgressPct: number | null } => {
  if (!startDate || !endDate || actualProgressPct === null) {
    return {
      schedule: { status: 'insufficient_data', label: RAG_LABEL.insufficient_data, detail: 'Needs start date, end date and site progress.' },
      expectedProgressPct: null,
    };
  }

  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const totalDuration = end - start;

  if (!(totalDuration > 0)) {
    return {
      schedule: { status: 'insufficient_data', label: RAG_LABEL.insufficient_data, detail: 'End date must be after start date.' },
      expectedProgressPct: null,
    };
  }

  const elapsed = Math.max(0, now - start);
  const expectedProgressPct = Math.min(100, (elapsed / totalDuration) * 100);
  const variance = actualProgressPct - expectedProgressPct;

  let status: RagStatus;
  let label: string;
  if (variance >= 5) { status = 'healthy'; label = 'Ahead'; }
  else if (variance >= -5) { status = 'healthy'; label = 'On track'; }
  else if (variance >= -10) { status = 'watch'; label = 'Watch'; }
  else if (variance >= -20) { status = 'at_risk'; label = 'At risk'; }
  else { status = 'critical'; label = 'Critical'; }

  const overdue = now > end && actualProgressPct < 100;
  const detail = overdue
    ? `${Math.round(variance)}% variance - past end date at ${Math.round(actualProgressPct)}% progress`
    : `${variance >= 0 ? '+' : ''}${Math.round(variance)}% variance vs expected ${Math.round(expectedProgressPct)}%`;

  return { schedule: { status, label, detail }, expectedProgressPct };
};

// D. Physical Progress (section 5) - linked to Schedule variance to avoid a
// second, independent judgment call; kept as its own row per spec, but not
// double-weighted in the score (see WEIGHTS below).
const calculateProgress = (
  actualProgressPct: number | null,
  expectedProgressPct: number | null
): ParamHealth => {
  if (actualProgressPct === null || expectedProgressPct === null) {
    return { status: 'insufficient_data', label: RAG_LABEL.insufficient_data, detail: 'Needs site progress and schedule dates.' };
  }
  const behind = expectedProgressPct - actualProgressPct;
  let status: RagStatus;
  if (behind <= 0) status = 'healthy';
  else if (behind <= 10) status = 'watch';
  else if (behind <= 20) status = 'at_risk';
  else status = 'critical';
  return {
    status,
    label: RAG_LABEL[status],
    detail: behind <= 0 ? `${Math.round(actualProgressPct)}% - on or ahead of schedule` : `${Math.round(behind)}% behind expected progress`,
  };
};

// B. Cost Health (section 3) - Forecast Final Cost vs Contract Budget.
// Forecast = non-subcontractor spend extrapolated by progress, plus the full
// known subcontractor contract commitments (not an estimate for that part).
const calculateCost = (
  budget: number,
  totalSpent: number,
  subconPaid: number,
  subconContractTotal: number,
  progressPct: number | null
): { cost: ParamHealth; forecastFinalCost: number | null } => {
  const nonSubconSpent = totalSpent - subconPaid;

  if (progressPct === null || progressPct <= 0) {
    return {
      cost: { status: 'insufficient_data', label: RAG_LABEL.insufficient_data, detail: `${fmt(totalSpent)} spent so far (${budget > 0 ? Math.round((totalSpent / budget) * 100) : 0}% of budget). Needs progress % to forecast.` },
      forecastFinalCost: null,
    };
  }

  const nonSubconForecast = nonSubconSpent / (progressPct / 100);
  const forecastFinalCost = nonSubconForecast + subconContractTotal;
  const variancePct = budget > 0 ? ((forecastFinalCost - budget) / budget) * 100 : 0;

  let status: RagStatus;
  if (variancePct <= 5) status = 'healthy';
  else if (variancePct <= 10) status = 'watch';
  else if (variancePct <= 15) status = 'at_risk';
  else status = 'critical';

  const detail = variancePct <= 0
    ? `Forecast ${fmt(forecastFinalCost)} of ${fmt(budget)} budget - ${Math.round(Math.abs(variancePct))}% under`
    : `Forecast ${fmt(forecastFinalCost)} of ${fmt(budget)} budget - ${Math.round(variancePct)}% over`;

  return { cost: { status, label: RAG_LABEL[status], detail }, forecastFinalCost };
};

// L. Profitability Health (section 12) - EAC-based, generic thresholds.
// EAC = Actual Cost + Outstanding Commitments + Estimated Cost to Complete.
// This works out to the same total as Forecast Final Cost above (same
// underlying forecast, different framing: budget compliance vs margin).
const calculateProfitability = (
  budget: number,
  forecastFinalCost: number | null
): ParamHealth => {
  if (forecastFinalCost === null) {
    return { status: 'insufficient_data', label: RAG_LABEL.insufficient_data, detail: 'Needs progress % to estimate cost to complete.' };
  }
  const forecastProfit = budget - forecastFinalCost;
  const marginPct = budget > 0 ? (forecastProfit / budget) * 100 : 0;

  let status: RagStatus;
  if (marginPct < 0) status = 'critical';
  else if (marginPct < 5) status = 'critical';
  else if (marginPct < 15) status = 'at_risk';
  else if (marginPct < 20) status = 'watch';
  else status = 'healthy';

  const detail = `${fmt(forecastProfit)} forecast profit (${Math.round(marginPct)}% margin)`;
  return { status, label: RAG_LABEL[status], detail };
};

// E. Commitments (section 6) - outstanding subcontractor balances relative
// to available cash.
const calculateCommitments = (
  outstandingCommitments: number,
  cashPosition: number
): ParamHealth => {
  if (outstandingCommitments <= 0) {
    return { status: 'healthy', label: RAG_LABEL.healthy, detail: 'No outstanding subcontractor balances.' };
  }
  if (cashPosition <= 0) {
    return { status: 'critical', label: RAG_LABEL.critical, detail: `${fmt(outstandingCommitments)} owed to subcontractors, no cash available.` };
  }
  const ratio = (outstandingCommitments / cashPosition) * 100;
  let status: RagStatus;
  if (ratio < 50) status = 'healthy';
  else if (ratio < 100) status = 'watch';
  else if (ratio < 150) status = 'at_risk';
  else status = 'critical';
  return { status, label: RAG_LABEL[status], detail: `${fmt(outstandingCommitments)} owed of ${fmt(cashPosition)} cash on hand` };
};

// C. Cashflow Health (section 4 + 11) - Cash After Commitments, combined
// with the Payment Gap against milestone-based contractual entitlement.
const calculateCashflow = (
  budget: number,
  received: number,
  totalSpent: number,
  outstandingCommitments: number,
  progressPct: number | null
): ParamHealth => {
  const cashPosition = received - totalSpent;
  const cashAfterCommitments = cashPosition - outstandingCommitments;
  const cashRatio = budget > 0 ? (cashAfterCommitments / budget) * 100 : 0;

  let baseStatus: RagStatus;
  if (cashRatio >= 5) baseStatus = 'healthy';
  else if (cashRatio >= 0) baseStatus = 'watch';
  else if (cashRatio >= -10) baseStatus = 'at_risk';
  else baseStatus = 'critical';

  let gapDetail = '';
  let combined = baseStatus;

  if (progressPct !== null && budget > 0) {
    const expectedEntitlement = getClaimableFraction(progressPct) * budget;
    const paymentGap = received - expectedEntitlement;
    const gapPct = (paymentGap / budget) * 100;

    if (gapPct < 0) {
      const gapSeverity: RagStatus = gapPct <= -20 ? 'at_risk' : gapPct <= -10 ? 'watch' : 'healthy';
      combined = worstOf(baseStatus, gapSeverity);
      gapDetail = ` · ${fmt(Math.abs(paymentGap))} behind payment schedule`;
    } else {
      gapDetail = ' · payments caught up with schedule';
    }
  }

  const detail = `Cash after commitments: ${fmt(cashAfterCommitments)}${gapDetail}`;
  return { status: combined, label: RAG_LABEL[combined], detail };
};

// Weighted Health Score (section 8) - supporting metric only, never
// overrides the worst-condition Overall status. Risk/Issues is always
// Insufficient Data for now (no data source), so its weight is dropped and
// the rest is renormalised rather than guessed.
const SCORE_VALUE: Record<RagStatus, number> = {
  healthy: 100,
  watch: 70,
  at_risk: 40,
  critical: 0,
  insufficient_data: NaN,
};

const WEIGHTS = {
  schedule: 25,
  cost: 20,
  cashflow: 20,
  progress: 10,
  profitability: 20,
  commitments: 5,
};

const calculateScore = (params: Record<keyof typeof WEIGHTS, ParamHealth>): number | null => {
  let weightedSum = 0;
  let weightTotal = 0;
  (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).forEach((key) => {
    const status = params[key].status;
    if (status === 'insufficient_data') return;
    weightedSum += SCORE_VALUE[status] * WEIGHTS[key];
    weightTotal += WEIGHTS[key];
  });
  if (weightTotal === 0) return null;
  return Math.round(weightedSum / weightTotal);
};

const buildExplanation = (result: Omit<ProjectHealthResult, 'explanation'>): string => {
  const drivers: string[] = [];
  const rows: [string, ParamHealth][] = [
    ['schedule', result.schedule],
    ['cost', result.cost],
    ['cashflow', result.cashflow],
    ['progress', result.progress],
    ['profitability', result.profitability],
    ['commitments', result.commitments],
  ];
  rows.forEach(([key, param]) => {
    if (param.status === result.overall && result.overall !== 'healthy') {
      drivers.push(key);
    }
  });

  if (result.overall === 'healthy') {
    return 'Project is currently within cost and cashflow control.';
  }

  const driverNames = drivers.length > 0 ? drivers.join(', ') : 'multiple areas';
  return `Overall status is held at ${RAG_LABEL[result.overall]} because of ${driverNames}, even though the score may look moderate - a serious issue in one area is not averaged away.`;
};

export const calculateProjectHealth = (input: ProjectHealthInput): ProjectHealthResult => {
  const subconPaid = input.subcontractors.reduce((sum, s) => sum + Math.min(s.paid, s.contractValue), 0);
  const subconContractTotal = input.subcontractors.reduce((sum, s) => sum + s.contractValue, 0);
  const outstandingCommitments = input.subcontractors.reduce(
    (sum, s) => sum + Math.max(0, s.contractValue - s.paid),
    0
  );
  const cashPosition = input.received - input.totalSpent;

  const { schedule, expectedProgressPct } = calculateSchedule(input.startDate, input.endDate, input.siteProgressPct);
  const progress = calculateProgress(input.siteProgressPct, expectedProgressPct);
  const { cost, forecastFinalCost } = calculateCost(
    input.budget,
    input.totalSpent,
    subconPaid,
    subconContractTotal,
    input.siteProgressPct
  );
  const profitability = calculateProfitability(input.budget, forecastFinalCost);
  const commitments = calculateCommitments(outstandingCommitments, cashPosition);
  const cashflow = calculateCashflow(
    input.budget,
    input.received,
    input.totalSpent,
    outstandingCommitments,
    input.siteProgressPct
  );
  const riskIssues: ParamHealth = {
    status: 'insufficient_data',
    label: RAG_LABEL.insufficient_data,
    detail: 'No risk or issue log recorded for this project.',
  };

  const overall = [schedule, cost, cashflow, progress, profitability, commitments].reduce(
    (worst, param) => worstOf(worst, param.status),
    'healthy' as RagStatus
  );

  const score = calculateScore({ schedule, cost, cashflow, progress, profitability, commitments });

  const base: Omit<ProjectHealthResult, 'explanation'> = {
    overall,
    schedule,
    cost,
    cashflow,
    progress,
    profitability,
    commitments,
    riskIssues,
    score,
  };

  return { ...base, explanation: buildExplanation(base) };
};

export const RAG_DOT_COLOR: Record<RagStatus, string> = {
  healthy: '#639922',
  watch: '#FAC775',
  at_risk: '#EF9F27',
  critical: '#E24B4A',
  insufficient_data: '#6B7280',
};

export const RAG_BADGE_CLASSES: Record<RagStatus, string> = {
  healthy: 'bg-green-500 bg-opacity-20 text-green-400',
  watch: 'bg-yellow-500 bg-opacity-20 text-yellow-400',
  at_risk: 'bg-orange-500 bg-opacity-20 text-orange-400',
  critical: 'bg-red-500 bg-opacity-20 text-red-400',
  insufficient_data: 'bg-gray-500 bg-opacity-20 text-gray-400',
};
