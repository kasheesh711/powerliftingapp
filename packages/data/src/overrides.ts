export interface CellOverride {
  blockName: string;
  cellA1: string;
  field: 'actualLoad' | 'rpe';
  value: string | number;
  updatedAtISO: string;
}

export interface ChangeRecord {
  timestamp: string;
  sheetName: string;
  cellA1: string;
  field: 'actualLoad' | 'rpe';
  oldValue: string | number | null;
  newValue: string | number;
  blockId: string;
  userId: string;
}

export interface OverrideRepository {
  get(blockName: string, cellA1: string): CellOverride | null;
  set(override: CellOverride): void;
  entriesForBlock(blockName: string): CellOverride[];
}

export class InMemoryOverrideRepository implements OverrideRepository {
  private map = new Map<string, CellOverride>();

  private key(blockName: string, cellA1: string): string {
    return `${blockName}|${cellA1.toUpperCase()}`;
  }

  get(blockName: string, cellA1: string): CellOverride | null {
    return this.map.get(this.key(blockName, cellA1)) || null;
  }

  set(override: CellOverride): void {
    this.map.set(this.key(override.blockName, override.cellA1), override);
  }

  entriesForBlock(blockName: string): CellOverride[] {
    return [...this.map.values()].filter((entry) => entry.blockName === blockName);
  }
}
