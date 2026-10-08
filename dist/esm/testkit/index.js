import { validateCatalog, validateData } from '../contract/validate.js';
const errorOf = (r) => {
    const e = r.json?.error;
    return typeof e === 'string' ? e : JSON.stringify(r.json);
};
/** Returns one line per failure, `[]` when every widget passes. Never throws. */
export async function checkWidgets(handler, cases = []) {
    const failures = handler.dropped.map((d) => `${d.widgetId ?? 'app'}: dropped: ${d.reason}`);
    const get = (path, params = {}) => handler.handle({ method: 'GET', path, query: new URLSearchParams(params) });
    let catalog;
    try {
        const r = await get('/api/hub/widgets');
        if (r === null || r.status !== 200)
            return [...failures, `catalog: ${r === null ? 'not served' : `${r.status} ${errorOf(r)}`}`];
        const v = validateCatalog(r.json);
        if (!v.ok)
            return [...failures, `catalog: ${v.reason}`];
        if (v.dropped.length > 0)
            return [...failures, ...v.dropped.map((d) => `catalog: ${d.widgetId ?? 'app'}: ${d.reason}`)];
        catalog = v.catalog;
    }
    catch (e) {
        return [...failures, `catalog: ${e instanceof Error ? e.message : String(e)}`];
    }
    const served = new Set(catalog.widgets.map((w) => w.id));
    for (const c of cases)
        if (!served.has(c.widget))
            failures.push(`${c.widget}: case names a widget the catalog does not serve`);
    for (const w of catalog.widgets) {
        const mine = cases.filter((c) => c.widget === w.id);
        const required = (w.params ?? []).find((p) => !p.optional);
        if (mine.length === 0 && required !== undefined) {
            failures.push(`${w.id}: param ${required.id} needs a case`);
            continue;
        }
        for (const params of mine.length > 0 ? mine.map((c) => c.params) : [{}]) {
            try {
                const r = await get(w.data, params);
                if (r === null || r.status !== 200) {
                    failures.push(`${w.id}: ${r === null ? 'not served' : `${r.status} ${errorOf(r)}`}`);
                    continue;
                }
                const v = validateData(w.render, r.json);
                if (!v.ok)
                    failures.push(`${w.id}: ${r.status} ${v.reason}`);
            }
            catch (e) {
                failures.push(`${w.id}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
    return failures;
}
