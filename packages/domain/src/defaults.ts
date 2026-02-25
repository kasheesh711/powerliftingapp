import type { AppConfig, Basics } from './types';

export const DEFAULT_COEFFICIENTS: AppConfig['coefficients'] = {
  DOTS_male: { a: -307.582, b: 24.0900756, c: -0.1918759221, d: 0.0007391293, e: -0.000001093 },
  DOTS_female: { a: -57.96288, b: 13.6175032, c: -0.1126655495, d: 0.0005158568, e: -0.0000010706 },
  WILKS_male: {
    a: -216.0475144,
    b: 16.2606339,
    c: -0.002388645,
    d: -0.00113732,
    e: 0.00000701863,
    f: -0.00000001291
  },
  WILKS_female: {
    a: 594.31747775582,
    b: -27.23842536447,
    c: 0.82112226871,
    d: -0.00930733913,
    e: 0.00004731582,
    f: -0.00000009054
  },
  GLPOINTS_male: { a: 1199.72839, b: 102.5181, c: 0.00921 },
  GLPOINTS_female: { a: 610.32796, b: 1045.59282, c: 0.03048 }
};

export const CALENDAR_INFO_SHEET_NAME = 'Calendar  Split  Info  PRs';

export function createDefaultConfig(): AppConfig {
  return {
    coefficients: JSON.parse(JSON.stringify(DEFAULT_COEFFICIENTS)),
    disableWrites: false
  };
}

export function createDefaultBasics(): Basics {
  return {
    bodyweight: 80,
    sex: 'male',
    squatBaseline: null,
    benchBaseline: null,
    deadliftBaseline: null
  };
}
