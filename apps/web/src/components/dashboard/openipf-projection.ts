import openIpfBaselines from './data/openipf-projection-baselines.json';

export type ProjectionSex = 'male' | 'female';
export type ProjectionLift = 'squat' | 'bench' | 'deadlift';

export interface OpenIpfClassContribution {
  weightClass: string;
  weight: number;
  rate: number;
  sampleSize: number;
}

export interface OpenIpfLiftTarget {
  rate: number;
  sampleSize: number;
  usedFallback: boolean;
  classContributors: OpenIpfClassContribution[];
}

export interface OpenIpfProjectionTargets {
  transition: number;
  transitionLabel: string;
  maxTransition: number;
  selectedWeightClasses: string[];
  liftTargets: Record<ProjectionLift, OpenIpfLiftTarget>;
  totalSampleSize: number;
}

export interface OpenIpfProjectionInput {
  sex: ProjectionSex;
  bodyweightKg: number;
  completedMeets: number;
  selectedWeightClasses: string[];
}

interface BaselineCohort {
  sampleSize: number;
  rates: {
    squat: number;
    bench: number;
    deadlift: number;
    total: number;
  };
}

interface BaselineJson {
  classes: Record<ProjectionSex, string[]>;
  classCentersKg: Record<ProjectionSex, Record<string, number>>;
  sexTransitionRates: Record<ProjectionSex, Record<string, BaselineCohort>>;
  sexClassTransitionRates: Record<ProjectionSex, Record<string, Record<string, BaselineCohort>>>;
}

const BASELINES = openIpfBaselines as BaselineJson;

const LIFTS: ProjectionLift[] = ['squat', 'bench', 'deadlift'];
const MALE_DEFAULT_CLASSES = ['74', '83'];

function clampNonNegative(value: number): number {
  return Math.max(0, value);
}

function toPositiveBodyweight(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 80;
  }

  return value;
}

function toTransitionFromCompletedMeets(completedMeets: number): number {
  if (!Number.isFinite(completedMeets) || completedMeets < 0) {
    return 1;
  }

  return Math.floor(completedMeets) + 1;
}

export function getOpenIpfWeightClassOptions(sex: ProjectionSex): string[] {
  return [...(BASELINES.classes[sex] || [])];
}

export function getDefaultSelectedWeightClasses(sex: ProjectionSex): string[] {
  if (sex === 'male') {
    return MALE_DEFAULT_CLASSES.filter((weightClass) => getOpenIpfWeightClassOptions('male').includes(weightClass));
  }

  return getOpenIpfWeightClassOptions('female');
}

export function normalizeSelectedWeightClasses(sex: ProjectionSex, selectedWeightClasses: string[]): string[] {
  const options = new Set(getOpenIpfWeightClassOptions(sex));
  const next: string[] = [];

  for (const value of selectedWeightClasses || []) {
    if (!options.has(value) || next.includes(value)) {
      continue;
    }
    next.push(value);
  }

  return next;
}

function getSexTransitionMap(sex: ProjectionSex): Record<string, BaselineCohort> {
  return BASELINES.sexTransitionRates[sex] || {};
}

function getMaxTransitionForSex(sex: ProjectionSex): number {
  const transitionMap = getSexTransitionMap(sex);
  const transitions = Object.keys(transitionMap)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!transitions.length) {
    return 1;
  }

  return Math.max(...transitions);
}

function getClassCenterKg(sex: ProjectionSex, weightClass: string): number | null {
  const center = BASELINES.classCentersKg[sex]?.[weightClass];
  if (!Number.isFinite(center)) {
    return null;
  }
  return center;
}

function getClassCohort(sex: ProjectionSex, weightClass: string, transition: number): BaselineCohort | null {
  const cohort = BASELINES.sexClassTransitionRates[sex]?.[weightClass]?.[String(transition)];
  return cohort || null;
}

function getSexCohort(sex: ProjectionSex, transition: number): BaselineCohort | null {
  const cohort = BASELINES.sexTransitionRates[sex]?.[String(transition)];
  return cohort || null;
}

function weightForClass(bodyweightKg: number, classCenterKg: number): number {
  const denominator = Math.max(Math.abs(bodyweightKg - classCenterKg), 0.5);
  return 1 / denominator;
}

export function resolveOpenIpfProjectionTargets(input: OpenIpfProjectionInput): OpenIpfProjectionTargets {
  const sex = input.sex;
  const bodyweightKg = toPositiveBodyweight(input.bodyweightKg);
  const maxTransition = getMaxTransitionForSex(sex);
  const transitionRequested = toTransitionFromCompletedMeets(input.completedMeets);
  const transition = Math.min(transitionRequested, maxTransition);

  const normalizedSelection = normalizeSelectedWeightClasses(sex, input.selectedWeightClasses);
  const selectedWeightClasses = normalizedSelection.length ? normalizedSelection : getDefaultSelectedWeightClasses(sex);

  const liftTargets = {} as Record<ProjectionLift, OpenIpfLiftTarget>;

  for (const lift of LIFTS) {
    const contributors: Array<{
      weightClass: string;
      rawWeight: number;
      cohort: BaselineCohort;
    }> = [];

    for (const weightClass of selectedWeightClasses) {
      const classCenter = getClassCenterKg(sex, weightClass);
      if (classCenter === null) {
        continue;
      }

      const cohort = getClassCohort(sex, weightClass, transition);
      if (!cohort) {
        continue;
      }

      contributors.push({
        weightClass,
        rawWeight: weightForClass(bodyweightKg, classCenter),
        cohort,
      });
    }

    if (!contributors.length) {
      const fallback = getSexCohort(sex, transition);
      const fallbackRate = fallback ? clampNonNegative(fallback.rates[lift]) : 0;
      liftTargets[lift] = {
        rate: fallbackRate,
        sampleSize: fallback?.sampleSize || 0,
        usedFallback: true,
        classContributors: [],
      };
      continue;
    }

    const weightTotal = contributors.reduce((sum, contributor) => sum + contributor.rawWeight, 0);
    const classContributors = contributors.map((contributor) => {
      const weight = weightTotal > 0 ? contributor.rawWeight / weightTotal : 0;
      return {
        weightClass: contributor.weightClass,
        weight,
        rate: clampNonNegative(contributor.cohort.rates[lift]),
        sampleSize: contributor.cohort.sampleSize,
      };
    });

    const weightedRate = classContributors.reduce((sum, contributor) => sum + contributor.weight * contributor.rate, 0);
    const weightedSample = classContributors.reduce((sum, contributor) => sum + contributor.weight * contributor.sampleSize, 0);

    liftTargets[lift] = {
      rate: clampNonNegative(weightedRate),
      sampleSize: Math.round(weightedSample),
      usedFallback: false,
      classContributors,
    };
  }

  const totalSampleSize = Math.max(
    liftTargets.squat.sampleSize,
    liftTargets.bench.sampleSize,
    liftTargets.deadlift.sampleSize
  );

  return {
    transition,
    transitionLabel: `${transition}->${transition + 1}`,
    maxTransition,
    selectedWeightClasses,
    liftTargets,
    totalSampleSize,
  };
}
