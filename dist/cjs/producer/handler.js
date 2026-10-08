"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHubHandler = createHubHandler;
const validate_js_1 = require("../contract/validate.js");
const build_js_1 = require("./build.js");
class HubError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
const reply = (status, json) => ({ status, json });
const fail = (status, error) => reply(status, { error });
const messageOf = (e) => (e instanceof Error ? e.message : String(e));
/** Throws when the catalog as a whole is invalid — a programming error the app's own tests catch. */
function createHubHandler({ app, widgets, onDrop = (d) => console.warn('lookout-widgets: dropped', d), now = () => new Date() }) {
    const result = (0, validate_js_1.validateCatalog)((0, build_js_1.buildCatalog)(app, widgets));
    if (!result.ok)
        throw new Error(result.reason);
    const catalog = result.catalog;
    for (const d of result.dropped)
        onDrop(d);
    // Only widgets that survived validation are reachable; a dropped one answers 404 like any unknown id.
    const served = new Set(catalog.widgets.map((w) => w.id));
    const decls = new Map(widgets.filter((d) => served.has(d.id)).map((d) => [d.id, d]));
    function readParams(decl, query) {
        const values = {};
        for (const p of decl.params ?? []) {
            const v = query.get(p.id);
            if (v === null || v === '') {
                if (p.optional)
                    continue;
                throw new HubError(400, `missing param ${p.id}`);
            }
            if (p.type === 'choice' && p.options !== undefined && !p.options.some((o) => o.value === v))
                throw new HubError(400, `invalid value for param ${p.id}`);
            values[p.id] = v;
        }
        return values;
    }
    function expand(decl, ids, rowId) {
        if (!Array.isArray(ids))
            return ids; // not ours to fix: the validator names what is wrong with it
        return ids.map((id) => {
            const a = (decl.actions ?? []).find((x) => x.id === id);
            if (a === undefined)
                throw new HubError(500, `unknown action ${String(id)}`);
            const out = { id: a.id, label: a.label, path: rowId === undefined ? (0, build_js_1.actionPath)(decl.id, a.id) : (0, build_js_1.rowActionPath)(decl.id, rowId, a.id) };
            if (a.confirm !== undefined)
                out.confirm = a.confirm;
            if (a.input !== undefined)
                out.input = a.input;
            return out;
        });
    }
    async function data(decl, query) {
        const params = readParams(decl, query);
        let loaded;
        try {
            loaded = { ...(await decl.load(params)) };
        }
        catch (e) {
            return fail(500, messageOf(e));
        }
        if (decl.render === 'list') {
            if (Array.isArray(loaded.rows)) {
                loaded.rows = loaded.rows.map((row) => {
                    if (row === null || typeof row !== 'object' || !('actions' in row))
                        return row;
                    const r = row;
                    return { ...r, actions: expand(decl, r.actions, String(r.id)) };
                });
            }
        }
        else if (loaded.actions !== undefined) {
            loaded.actions = expand(decl, loaded.actions);
        }
        const checked = (0, validate_js_1.validateData)(decl.render, { ...loaded, updatedAt: now().toISOString() });
        return checked.ok ? reply(200, checked.data) : fail(500, checked.reason);
    }
    async function options(decl, paramId) {
        const load = decl.params?.find((p) => p.id === paramId)?.loadOptions;
        if (load === undefined)
            return fail(404, 'not found');
        const opts = await load();
        const valid = (o) => {
            const { value, label } = (o ?? {});
            return typeof value === 'string' && value !== '' && typeof label === 'string' && label !== '';
        };
        return Array.isArray(opts) && opts.every(valid) ? reply(200, { options: opts }) : fail(500, 'invalid option');
    }
    async function action(decl, actionId, rowId, body) {
        const a = decl.actions?.find((x) => x.id === actionId);
        if (a === undefined)
            return fail(404, 'not found');
        const raw = body !== null && typeof body === 'object' ? body.input : undefined;
        const r = await a.run(typeof raw === 'string' ? raw : undefined, rowId);
        const { ok, message } = (r ?? {});
        if (typeof ok !== 'boolean' || (message !== undefined && typeof message !== 'string'))
            return fail(500, 'invalid action reply');
        return reply(200, message === undefined ? { ok } : { ok, message });
    }
    async function route(req) {
        const root = (0, build_js_1.catalogPath)();
        if (req.path !== root && !req.path.startsWith(`${root}/`))
            return null;
        if (req.method !== 'GET' && req.method !== 'POST')
            return null;
        if (req.path === root)
            return req.method === 'GET' ? reply(200, catalog) : fail(404, 'not found');
        const segs = req.path.slice(root.length + 1).split('/');
        const get = req.method === 'GET';
        if (segs.length === 1 && segs[0] !== '' && get) {
            const decl = decls.get(segs[0]);
            return decl === undefined ? fail(404, `unknown widget ${segs[0]}`) : data(decl, req.query);
        }
        const decl = decls.get(segs[0]);
        if (decl === undefined)
            return fail(404, 'not found');
        if (segs.length === 4 && segs[1] === 'params' && segs[3] === 'options' && get)
            return options(decl, segs[2]);
        if (segs.length === 3 && segs[1] === 'actions' && !get)
            return action(decl, segs[2], undefined, req.body);
        if (segs.length === 5 && segs[1] === 'rows' && segs[3] === 'actions' && !get) {
            let rowId;
            try {
                rowId = decodeURIComponent(segs[2]);
            }
            catch {
                return fail(404, 'not found');
            }
            if (rowId !== '')
                return action(decl, segs[4], rowId, req.body);
        }
        return fail(404, 'not found');
    }
    return {
        dropped: result.dropped,
        async handle(req) {
            try {
                return await route(req);
            }
            catch (e) {
                return e instanceof HubError ? fail(e.status, e.message) : fail(500, messageOf(e));
            }
        }
    };
}
