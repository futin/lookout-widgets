"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.examples = void 0;
// Example catalogs and data responses for every render type. The fixture app serves them (Task 6) and later tests refer to the ids below, so they are pinned:
// stat `queue` (the only required param, `window`), gauge `usage` (optional `optionsFrom` param `project`), list `runs` (row actions, `open: "/"`, no params),
// status `health`. `updatedAt` is a fixed timestamp so fixtures are deterministic; callers that need fresh data spread the response and override it.
const updatedAt = '2026-10-07T12:00:00.000Z';
const full = {
    contract: 1,
    app: { name: 'Example app' },
    widgets: [
        {
            id: 'queue',
            title: 'Queue',
            render: 'stat',
            data: '/api/hub/widgets/queue',
            refreshSeconds: 10,
            params: [
                {
                    id: 'window',
                    label: 'Window',
                    type: 'choice',
                    options: [
                        { value: '1h', label: 'Last hour' },
                        { value: '24h', label: 'Last 24 hours' },
                        { value: '7d', label: 'Last 7 days' }
                    ]
                }
            ]
        },
        {
            id: 'usage',
            title: 'Usage',
            render: 'gauge',
            data: '/api/hub/widgets/usage',
            refreshSeconds: 30,
            params: [{ id: 'project', label: 'Project', type: 'choice', optionsFrom: '/api/hub/options/projects', optional: true }]
        },
        { id: 'runs', title: 'Runs', render: 'list', data: '/api/hub/widgets/runs', refreshSeconds: 5, open: '/' },
        { id: 'health', title: 'Health', render: 'status', data: '/api/hub/widgets/health', refreshSeconds: 15 }
    ]
};
const empty = { contract: 1, app: { name: 'Example app' }, widgets: [] };
const queue = {
    updatedAt,
    value: 12,
    unit: 'jobs',
    caption: 'waiting to start',
    tone: 'ok',
    actions: [{ id: 'reset', label: 'Reset', path: '/api/hub/actions/reset' }]
};
const usage = {
    updatedAt,
    bars: [
        { label: 'Session', percent: 42, resetsAt: '2026-10-07T17:00:00.000Z' },
        { label: 'Week', percent: 71 }
    ]
};
const runs = {
    updatedAt,
    total: 3,
    rows: [
        {
            id: 'run-1',
            title: 'Nightly import',
            subtitle: 'started 12:01',
            status: 'running',
            open: '/runs/run-1',
            actions: [{ id: 'pause', label: 'Pause', path: '/api/hub/actions/pause' }]
        },
        {
            id: 'run-2',
            title: 'Report build',
            subtitle: 'failed 11:40',
            status: 'error',
            actions: [{ id: 'cancel', label: 'Cancel', path: '/api/hub/actions/cancel', confirm: 'Cancel this run?' }]
        },
        {
            id: 'run-3',
            title: 'Backup',
            subtitle: 'waiting for an answer',
            status: 'warn',
            actions: [
                {
                    id: 'reply',
                    label: 'Reply',
                    path: '/api/hub/actions/reply',
                    input: { label: 'Your answer', options: ['Continue', 'Skip'], text: true }
                }
            ]
        }
    ]
};
const health = { updatedAt, state: 'ok', label: 'All systems normal', detail: 'Last check passed' };
exports.examples = {
    catalogs: { full, empty },
    data: { queue, usage, runs, health }
};
