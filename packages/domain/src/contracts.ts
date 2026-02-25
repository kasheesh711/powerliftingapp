import { z } from 'zod';

export const cellUpdateInputSchema = z.object({
  cellA1: z.string().min(1),
  newValue: z.union([z.string(), z.number()]),
  originalValue: z.union([z.string(), z.number(), z.null()]),
  field: z.enum(['actualLoad', 'rpe'])
});

export const updateBlockCellsBodySchema = z.object({
  updates: z.array(cellUpdateInputSchema).min(1),
  forceOverwrite: z.boolean().optional().default(false)
});

export const blockQuerySchema = z.object({
  forceRefresh: z
    .string()
    .optional()
    .transform((value) => value === 'true')
});

export const spreadsheetSelectSchema = z
  .object({
    spreadsheetUrl: z.string().url().optional(),
    spreadsheetId: z.string().min(1).optional()
  })
  .refine((data) => Boolean(data.spreadsheetId || data.spreadsheetUrl), {
    message: 'Either spreadsheetId or spreadsheetUrl is required.'
  });

export const conflictDetailSchema = z.object({
  cellA1: z.string(),
  serverValue: z.string(),
  requestedOriginal: z.union([z.string(), z.number(), z.null()])
});

export const updateOkSchema = z.object({
  status: z.literal('ok'),
  updatedRows: z.array(z.record(z.any())),
  stats: z.record(z.any()),
  parserReport: z.record(z.any())
});

export const updateConflictSchema = z.object({
  status: z.literal('conflict'),
  conflicts: z.array(conflictDetailSchema),
  message: z.string()
});

export const updateResultSchema = z.union([updateOkSchema, updateConflictSchema]);

export type CellUpdateInputDTO = z.infer<typeof cellUpdateInputSchema>;
export type SpreadsheetSelectDTO = z.infer<typeof spreadsheetSelectSchema>;
export type UpdateBlockCellsBodyDTO = z.infer<typeof updateBlockCellsBodySchema>;
