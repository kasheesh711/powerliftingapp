import type { DataQueryOptions, IDataStore } from './datastore';
import { computeAllStats, computeOverallPrimaryProgress } from './stats';
import type { DashboardPayload, UserContext } from './types';

export async function loadDashboardPayload(
  store: IDataStore,
  user: UserContext,
  blockIdOrName: string,
  opts: DataQueryOptions = {}
): Promise<DashboardPayload> {
  const blockData = await store.getBlockData(user, blockIdOrName, opts);
  const initial = await store.getInitialPayload(user);
  const stats = computeAllStats(blockData, initial.basics, initial.config);

  const blocks = await store.getAvailableBlocks(user, opts);
  const overallProgress = await computeOverallPrimaryProgress(
    blocks,
    (blockName, forceRefresh) =>
      store.getBlockData(user, blockName, {
        forceRefresh
      }),
    opts.forceRefresh || false
  );

  return {
    blockData,
    stats,
    basics: initial.basics,
    config: initial.config,
    overallProgress
  };
}
