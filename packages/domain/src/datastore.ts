import type {
  BlockData,
  BlockDescriptor,
  CellUpdateInput,
  InitialPayload,
  OverallPrimaryProgress,
  UpdateResult,
  UserContext
} from './types';

export interface DataQueryOptions {
  forceRefresh?: boolean;
}

export interface IDataStore {
  getInitialPayload(user: UserContext): Promise<InitialPayload>;
  getAvailableBlocks(user: UserContext, opts?: DataQueryOptions): Promise<BlockDescriptor[]>;
  getBlockData(user: UserContext, blockIdOrName: string, opts?: DataQueryOptions): Promise<BlockData>;
  getOverallPrimaryProgress(
    user: UserContext,
    opts?: DataQueryOptions
  ): Promise<OverallPrimaryProgress>;
  updateBlockCells(
    user: UserContext,
    blockIdOrName: string,
    updates: CellUpdateInput[],
    forceOverwrite?: boolean
  ): Promise<UpdateResult>;
}
