import type { IDataStore, UserContext } from '@powerlifting/domain';

interface ParityMismatch {
  path: string;
  left: unknown;
  right: unknown;
}

export interface ParityResult {
  blockName: string;
  matches: boolean;
  mismatches: ParityMismatch[];
}

function compareJson(
  left: unknown,
  right: unknown,
  path: string,
  mismatches: ParityMismatch[],
  tolerance: number
): void {
  if (typeof left === 'number' && typeof right === 'number') {
    if (Math.abs(left - right) > tolerance) {
      mismatches.push({ path, left, right });
    }
    return;
  }

  if (left === right) {
    return;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const maxLen = Math.max(left.length, right.length);
    for (let i = 0; i < maxLen; i++) {
      compareJson(left[i], right[i], `${path}[${i}]`, mismatches, tolerance);
    }
    return;
  }

  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(leftObj), ...Object.keys(rightObj)])].sort();

    for (const key of keys) {
      compareJson(leftObj[key], rightObj[key], `${path}.${key}`, mismatches, tolerance);
    }

    return;
  }

  mismatches.push({ path, left, right });
}

export async function runParityComparison(input: {
  excelStore: IDataStore;
  googleStore: IDataStore;
  user: UserContext;
  blockNames: string[];
  floatTolerance?: number;
}): Promise<ParityResult[]> {
  const tolerance = input.floatTolerance ?? 1e-6;
  const results: ParityResult[] = [];

  for (const blockName of input.blockNames) {
    const [excelBlock, googleBlock] = await Promise.all([
      input.excelStore.getBlockData(input.user, blockName),
      input.googleStore.getBlockData(input.user, blockName)
    ]);

    const mismatches: ParityMismatch[] = [];
    compareJson(excelBlock, googleBlock, '$', mismatches, tolerance);

    results.push({
      blockName,
      matches: mismatches.length === 0,
      mismatches
    });
  }

  return results;
}
