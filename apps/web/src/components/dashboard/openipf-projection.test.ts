import baselines from './data/openipf-projection-baselines.json';
import {
  getDefaultSelectedWeightClasses,
  getOpenIpfWeightClassOptions,
  resolveOpenIpfProjectionTargets,
} from './openipf-projection';
import { describe, expect, it } from 'vitest';

describe('openipf projection baselines artifact', () => {
  it('contains expected top-level keys', () => {
    expect(baselines).toHaveProperty('metadata');
    expect(baselines).toHaveProperty('classes');
    expect(baselines).toHaveProperty('classCentersKg');
    expect(baselines).toHaveProperty('sexTransitionRates');
    expect(baselines).toHaveProperty('sexClassTransitionRates');
  });

  it('has nonzero sample counts for men 74/83 early transitions', () => {
    const men = baselines.sexClassTransitionRates.male;
    const transition74 = men['74']?.['1']?.sampleSize || 0;
    const transition83 = men['83']?.['1']?.sampleSize || 0;

    expect(transition74).toBeGreaterThan(0);
    expect(transition83).toBeGreaterThan(0);
  });
});

describe('resolveOpenIpfProjectionTargets', () => {
  it('maps first meet progression to transition 1->2', () => {
    const result = resolveOpenIpfProjectionTargets({
      sex: 'male',
      bodyweightKg: 77,
      completedMeets: 0,
      selectedWeightClasses: ['74', '83'],
    });

    expect(result.transition).toBe(1);
    expect(result.transitionLabel).toBe('1->2');
  });

  it('maps completed meets to n->n+1 transition', () => {
    const result = resolveOpenIpfProjectionTargets({
      sex: 'male',
      bodyweightKg: 77,
      completedMeets: 4,
      selectedWeightClasses: ['74', '83'],
    });

    expect(result.transition).toBe(5);
    expect(result.transitionLabel).toBe('5->6');
  });

  it('clamps high meet count to max transition', () => {
    const result = resolveOpenIpfProjectionTargets({
      sex: 'male',
      bodyweightKg: 77,
      completedMeets: 999,
      selectedWeightClasses: ['74', '83'],
    });

    expect(result.transition).toBe(result.maxTransition);
  });

  it('separates male and female baseline rates', () => {
    const male = resolveOpenIpfProjectionTargets({
      sex: 'male',
      bodyweightKg: 77,
      completedMeets: 0,
      selectedWeightClasses: ['74', '83'],
    });
    const female = resolveOpenIpfProjectionTargets({
      sex: 'female',
      bodyweightKg: 63,
      completedMeets: 0,
      selectedWeightClasses: ['63'],
    });

    expect(male.liftTargets.squat.rate).not.toBe(female.liftTargets.squat.rate);
  });

  it('weights 74 class more than 83 at 77kg', () => {
    const result = resolveOpenIpfProjectionTargets({
      sex: 'male',
      bodyweightKg: 77,
      completedMeets: 0,
      selectedWeightClasses: ['74', '83'],
    });

    const contributors = result.liftTargets.squat.classContributors;
    const from74 = contributors.find((entry) => entry.weightClass === '74');
    const from83 = contributors.find((entry) => entry.weightClass === '83');

    expect(from74).toBeDefined();
    expect(from83).toBeDefined();
    expect((from74?.weight || 0) > (from83?.weight || 0)).toBe(true);
  });

  it('floors cohort target rates at zero', () => {
    const result = resolveOpenIpfProjectionTargets({
      sex: 'male',
      bodyweightKg: 93,
      completedMeets: 40,
      selectedWeightClasses: ['93'],
    });

    expect(result.liftTargets.squat.rate).toBeGreaterThanOrEqual(0);
    expect(result.liftTargets.bench.rate).toBeGreaterThanOrEqual(0);
    expect(result.liftTargets.deadlift.rate).toBeGreaterThanOrEqual(0);
  });
});

describe('OpenIPF defaults', () => {
  it('returns expected default classes by sex', () => {
    expect(getDefaultSelectedWeightClasses('male')).toEqual(['74', '83']);
    expect(getDefaultSelectedWeightClasses('female')).toEqual(getOpenIpfWeightClassOptions('female'));
  });
});
