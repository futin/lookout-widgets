// Serves the declared widgets under /api/hub/widgets, framework-free: the app adapts its own request and response (spec §3.3).
import type { Action, Catalog } from '../contract/types.js';
import { validateCatalog, validateData, type Dropped } from '../contract/validate.js';
import { actionPath, buildCatalog, catalogPath, rowActionPath } from './build.js';
import type { AppInfo, ParamValues, WidgetDecl } from './declare.js';

export interface HubRequest {
  method: string;
  /** Path without the query string. */
  path: string;
  query: URLSearchParams;
  body?: unknown;
}

export interface HubReply {
  status: number;
  json: unknown;
}

export interface HubHandler {
  /** `null` means the request is not ours — the app falls through to its own routes. Never rejects. */
  handle(req: HubRequest): Promise<HubReply | null>;
  /** Creation-time drops, also sent to `onDrop`. The served catalog is already normalised, so this is where a drop stays observable. */
  dropped: Dropped[];
}

export interface HubHandlerOptions {
  app: AppInfo;
  widgets: WidgetDecl[];
  onDrop?: (d: Dropped) => void;
  now?: () => Date;
}

class HubError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

const reply = (status: number, json: unknown): HubReply => ({ status, json });
const fail = (status: number, error: string): HubReply => reply(status, { error });
const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));
// A URL parser collapses these segments (`%2E` spellings too), so a row action path carrying one reaches another route: `..` lands on the widget action.
const dotSegment = (rowId: string): boolean => rowId === '.' || rowId === '..';

/** Throws when the catalog as a whole is invalid — a programming error the app's own tests catch. */
export function createHubHandler({ app, widgets, onDrop = (d) => console.warn('lookout-widgets: dropped', d), now = () => new Date() }: HubHandlerOptions): HubHandler {
  const result = validateCatalog(buildCatalog(app, widgets));
  if (!result.ok) throw new Error(result.reason);
  const catalog: Catalog = result.catalog;
  for (const d of result.dropped) onDrop(d);

  // Only widgets that survived validation are reachable; a dropped one answers 404 like any unknown id.
  const served = new Set(catalog.widgets.map((w) => w.id));
  const decls = new Map(widgets.filter((d) => served.has(d.id)).map((d) => [d.id, d]));

  function readParams(decl: WidgetDecl, query: URLSearchParams): ParamValues {
    const values: ParamValues = {};
    for (const p of decl.params ?? []) {
      const v = query.get(p.id);
      if (v === null || v === '') {
        if (p.optional) continue;
        throw new HubError(400, `missing param ${p.id}`);
      }
      if (p.type === 'choice' && p.options !== undefined && !p.options.some((o) => o.value === v)) throw new HubError(400, `invalid value for param ${p.id}`);
      values[p.id] = v;
    }
    return values;
  }

  function expand(decl: WidgetDecl, ids: unknown, rowId?: string): unknown {
    if (!Array.isArray(ids)) return ids; // not ours to fix: the validator names what is wrong with it
    if (rowId !== undefined && dotSegment(rowId)) throw new HubError(500, `row id ${rowId} cannot carry actions`);
    return ids.map((id): Action => {
      const a = (decl.actions ?? []).find((x) => x.id === id);
      if (a === undefined) throw new HubError(500, `unknown action ${String(id)}`);
      const out: Action = { id: a.id, label: a.label, path: rowId === undefined ? actionPath(decl.id, a.id) : rowActionPath(decl.id, rowId, a.id) };
      if (a.confirm !== undefined) out.confirm = a.confirm;
      if (a.input !== undefined) out.input = a.input;
      return out;
    });
  }

  async function data(decl: WidgetDecl, query: URLSearchParams): Promise<HubReply> {
    const params = readParams(decl, query);
    let loaded: Record<string, unknown>;
    try {
      loaded = { ...((await decl.load(params)) as object) };
    } catch (e) {
      return fail(500, messageOf(e));
    }
    if (decl.render === 'list') {
      if (Array.isArray(loaded.rows)) {
        loaded.rows = loaded.rows.map((row: unknown) => {
          if (row === null || typeof row !== 'object' || !('actions' in row)) return row;
          const r = row as { id?: unknown; actions?: unknown };
          return { ...r, actions: expand(decl, r.actions, String(r.id)) };
        });
      }
    } else if (loaded.actions !== undefined) {
      loaded.actions = expand(decl, loaded.actions);
    }
    const checked = validateData(decl.render, { ...loaded, updatedAt: now().toISOString() });
    return checked.ok ? reply(200, checked.data) : fail(500, checked.reason);
  }

  async function options(decl: WidgetDecl, paramId: string): Promise<HubReply> {
    const load = decl.params?.find((p) => p.id === paramId)?.loadOptions;
    if (load === undefined) return fail(404, 'not found');
    const opts: unknown = await load();
    const valid = (o: unknown) => {
      const { value, label } = (o ?? {}) as { value?: unknown; label?: unknown };
      return typeof value === 'string' && value !== '' && typeof label === 'string' && label !== '';
    };
    return Array.isArray(opts) && opts.every(valid) ? reply(200, { options: opts }) : fail(500, 'invalid option');
  }

  async function action(decl: WidgetDecl, actionId: string, rowId: string | undefined, body: unknown): Promise<HubReply> {
    const a = decl.actions?.find((x) => x.id === actionId);
    if (a === undefined) return fail(404, 'not found');
    const raw = body !== null && typeof body === 'object' ? (body as { input?: unknown }).input : undefined;
    const r: unknown = await a.run(typeof raw === 'string' ? raw : undefined, rowId);
    const { ok, message } = (r ?? {}) as { ok?: unknown; message?: unknown };
    if (typeof ok !== 'boolean' || (message !== undefined && typeof message !== 'string')) return fail(500, 'invalid action reply');
    return reply(200, message === undefined ? { ok } : { ok, message });
  }

  async function route(req: HubRequest): Promise<HubReply | null> {
    const root = catalogPath();
    if (req.path !== root && !req.path.startsWith(`${root}/`)) return null;
    if (req.method !== 'GET' && req.method !== 'POST') return null;

    if (req.path === root) return req.method === 'GET' ? reply(200, catalog) : fail(404, 'not found');
    const segs = req.path.slice(root.length + 1).split('/');
    const get = req.method === 'GET';
    if (segs.length === 1 && segs[0] !== '' && get) {
      const decl = decls.get(segs[0]);
      return decl === undefined ? fail(404, `unknown widget ${segs[0]}`) : data(decl, req.query);
    }
    const decl = decls.get(segs[0]);
    if (decl === undefined) return fail(404, 'not found');
    if (segs.length === 4 && segs[1] === 'params' && segs[3] === 'options' && get) return options(decl, segs[2]);
    if (segs.length === 3 && segs[1] === 'actions' && !get) return action(decl, segs[2], undefined, req.body);
    if (segs.length === 5 && segs[1] === 'rows' && segs[3] === 'actions' && !get) {
      let rowId: string;
      try {
        rowId = decodeURIComponent(segs[2]);
      } catch {
        return fail(404, 'not found');
      }
      if (rowId !== '' && !dotSegment(rowId)) return action(decl, segs[4], rowId, req.body);
    }
    return fail(404, 'not found');
  }

  return {
    dropped: result.dropped,
    async handle(req) {
      try {
        return await route(req);
      } catch (e) {
        return e instanceof HubError ? fail(e.status, e.message) : fail(500, messageOf(e));
      }
    }
  };
}
