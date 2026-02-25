export const dashboardOpenApi = {
  openapi: '3.1.0',
  info: {
    title: 'Powerlifting Dashboard API',
    version: '1.0.0'
  },
  paths: {
    '/api/dashboard/initial': {
      get: { summary: 'Bootstrap payload (blocks + basics + config)' }
    },
    '/api/dashboard/blocks': {
      get: { summary: 'List available blocks' }
    },
    '/api/dashboard/block/{blockName}': {
      get: { summary: 'Load full dashboard data for a block' }
    },
    '/api/dashboard/block/{blockName}/updates': {
      post: { summary: 'Update actualLoad and rpe cells with conflict detection' }
    },
    '/api/spreadsheets/select': {
      get: { summary: 'Get selected spreadsheet for authenticated user' },
      post: { summary: 'Persist selected spreadsheet by ID or URL' }
    },
    '/api/spreadsheets/picker-token': {
      get: { summary: 'Get Google access token for Drive Picker' }
    },
    '/api/spreadsheets/picker-config': {
      get: { summary: 'Get Google Drive Picker configuration' }
    }
  }
} as const;
