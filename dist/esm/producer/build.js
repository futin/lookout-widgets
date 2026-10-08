const ID = /^[a-z0-9][a-z0-9-]*$/;
export const catalogPath = () => '/api/hub/widgets';
export const dataPath = (widgetId) => `${catalogPath()}/${widgetId}`;
export const optionsPath = (widgetId, paramId) => `${dataPath(widgetId)}/params/${paramId}/options`;
export const actionPath = (widgetId, actionId) => `${dataPath(widgetId)}/actions/${actionId}`;
// The row id rides in the path because the hub POSTs only `{ input }` to an action's path.
export const rowActionPath = (widgetId, rowId, actionId) => `${dataPath(widgetId)}/rows/${encodeURIComponent(rowId)}/actions/${actionId}`;
function checkId(kind, id, where = '') {
    if (typeof id !== 'string' || !ID.test(id))
        throw new Error(`${kind} id ${JSON.stringify(id)}${where} must match ${ID}`);
}
function checkUnique(kind, ids, where) {
    const seen = new Set();
    for (const id of ids) {
        if (seen.has(id))
            throw new Error(`duplicate ${kind} id "${id}"${where}`);
        seen.add(id);
    }
}
/** Throws on a malformed or duplicate id, or a param with both `options` and `loadOptions` — programming errors, caught by the app's own tests. */
export function buildCatalog(app, decls) {
    for (const d of decls)
        checkId('widget', d.id);
    checkUnique('widget', decls.map((d) => d.id), '');
    const widgets = decls.map((d) => {
        const where = ` in widget "${d.id}"`;
        const params = d.params ?? [];
        const actions = d.actions ?? [];
        for (const p of params)
            checkId('param', p.id, where);
        for (const a of actions)
            checkId('action', a.id, where);
        checkUnique('param', params.map((p) => p.id), where);
        checkUnique('action', actions.map((a) => a.id), where);
        const w = { id: d.id, title: d.title, render: d.render, refreshSeconds: d.refreshSeconds, data: dataPath(d.id) };
        if (d.open !== undefined)
            w.open = d.open;
        if (params.length > 0) {
            w.params = params.map((p) => {
                if (p.options !== undefined && p.loadOptions !== undefined)
                    throw new Error(`param "${p.id}"${where} has both options and loadOptions`);
                const out = { id: p.id, label: p.label, type: p.type };
                if (p.options !== undefined)
                    out.options = p.options;
                if (p.loadOptions !== undefined)
                    out.optionsFrom = optionsPath(d.id, p.id);
                if (p.optional !== undefined)
                    out.optional = p.optional;
                return out;
            });
        }
        return w;
    });
    return { contract: 1, app, widgets };
}
