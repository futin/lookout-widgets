"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCatalog = validateCatalog;
exports.validateData = validateData;
const paths_js_1 = require("./paths.js");
const RENDER_TYPES = ['stat', 'gauge', 'list', 'status'];
const TONES = ['ok', 'warn', 'error', 'muted'];
const STATES = ['ok', 'warn', 'error', 'idle'];
const ROW_STATUSES = ['ok', 'warn', 'error', 'idle', 'running'];
const MIN_REFRESH = 2;
const MAX_REFRESH = 3600;
// Inner parsers return a value or throw Invalid; the public functions turn that into a result. This keeps each rule one line and the reasons specific.
class Invalid extends Error {
}
const fail = (reason) => {
    throw new Invalid(reason);
};
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isDateString = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
function str(o, key, where) {
    const v = o[key];
    if (typeof v !== 'string' || v === '')
        fail(`${where}${key} must be a non-empty string`);
    return v;
}
function optStr(o, key, where) {
    if (o[key] === undefined)
        return undefined;
    if (typeof o[key] !== 'string')
        fail(`${where}${key} must be a string`);
    return o[key];
}
function path(o, key, where) {
    const v = o[key];
    if (typeof v !== 'string' || !(0, paths_js_1.isRelativePath)(v))
        fail(`${where}${key} must be a relative path`);
    return v;
}
function optPath(o, key, where) {
    return o[key] === undefined ? undefined : path(o, key, where);
}
function oneOf(o, key, allowed, where) {
    const v = o[key];
    if (typeof v !== 'string' || !allowed.includes(v))
        fail(`${where}${key} must be one of ${allowed.join(', ')}`);
    return v;
}
function optOneOf(o, key, allowed, where) {
    return o[key] === undefined ? undefined : oneOf(o, key, allowed, where);
}
function array(o, key, where) {
    if (!Array.isArray(o[key]))
        fail(`${where}${key} must be an array`);
    return o[key];
}
function object(v, where) {
    if (!isObj(v))
        fail(`${where} must be an object`);
    return v;
}
// Assigns only defined values, so optional fields that are absent stay absent in the result.
function compact(o) {
    for (const k of Object.keys(o))
        if (o[k] === undefined)
            delete o[k];
    return o;
}
// ---- catalog ----------------------------------------------------------------------------------------------------------------------------------------
function parseParam(raw, index) {
    const where = `param ${index}: `;
    const o = object(raw, `param ${index}`);
    const id = str(o, 'id', where);
    const w = `param "${id}": `;
    const label = str(o, 'label', w);
    const type = oneOf(o, 'type', ['choice', 'text'], w);
    let options;
    if (o.options !== undefined) {
        options = array(o, 'options', w).map((opt, i) => {
            const oo = object(opt, `${w}options[${i}]`);
            return { value: str(oo, 'value', `${w}options[${i}].`), label: str(oo, 'label', `${w}options[${i}].`) };
        });
    }
    const optionsFrom = optPath(o, 'optionsFrom', w);
    if (o.optional !== undefined && typeof o.optional !== 'boolean')
        fail(`${w}optional must be a boolean`);
    return compact({ id, label, type, options, optionsFrom, optional: o.optional });
}
function parseWidget(o, id) {
    const title = str(o, 'title', '');
    const render = o.render;
    if (typeof render !== 'string' || !RENDER_TYPES.includes(render))
        fail(`unknown render ${JSON.stringify(render)}`);
    const data = path(o, 'data', '');
    const refresh = o.refreshSeconds;
    if (!isFiniteNumber(refresh))
        fail('refreshSeconds must be a number');
    const open = optPath(o, 'open', '');
    const params = o.params === undefined ? undefined : array(o, 'params', '').map(parseParam);
    return compact({
        id,
        title,
        render: render,
        data,
        refreshSeconds: Math.min(MAX_REFRESH, Math.max(MIN_REFRESH, refresh)),
        open,
        params
    });
}
function validateCatalog(raw) {
    if (!isObj(raw))
        return { ok: false, reason: 'catalog must be a JSON object' };
    const c = raw.contract;
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 1)
        return { ok: false, reason: 'contract must be a positive integer' };
    if (c > 1)
        return { ok: false, reason: 'needs a newer Lookout' };
    if (!isObj(raw.app) || typeof raw.app.name !== 'string' || raw.app.name === '')
        return { ok: false, reason: 'app.name must be a non-empty string' };
    if (!Array.isArray(raw.widgets))
        return { ok: false, reason: 'widgets must be an array' };
    const widgets = [];
    const dropped = [];
    const app = { name: raw.app.name };
    const icon = raw.app.icon;
    if (icon !== undefined) {
        if (typeof icon === 'string' && (0, paths_js_1.isRelativePath)(icon))
            app.icon = icon;
        else
            dropped.push({ widgetId: null, reason: 'app.icon must be a relative path' });
    }
    const seen = new Set();
    for (const entry of raw.widgets) {
        const widgetId = isObj(entry) && typeof entry.id === 'string' && entry.id !== '' ? entry.id : null;
        try {
            if (!isObj(entry))
                fail('widget must be an object');
            if (widgetId === null)
                fail('id must be a non-empty string');
            const widget = parseWidget(entry, widgetId);
            if (seen.has(widget.id))
                fail('duplicate id');
            seen.add(widget.id);
            widgets.push(widget);
        }
        catch (e) {
            if (!(e instanceof Invalid))
                throw e;
            dropped.push({ widgetId, reason: e.message });
        }
    }
    return { ok: true, catalog: { contract: 1, app, widgets }, dropped };
}
// ---- data -------------------------------------------------------------------------------------------------------------------------------------------
function parseAction(raw, where) {
    const o = object(raw, where);
    const w = `${where}.`;
    const id = str(o, 'id', w);
    const label = str(o, 'label', w);
    const p = path(o, 'path', w);
    const confirm = optStr(o, 'confirm', w);
    let input;
    if (o.input !== undefined) {
        const i = object(o.input, `${w}input`);
        const iw = `${w}input.`;
        const inputLabel = str(i, 'label', iw);
        let options;
        if (i.options !== undefined) {
            options = array(i, 'options', iw).map((v) => (typeof v === 'string' ? v : fail(`${iw}options must hold strings`)));
            if (options.length === 0)
                options = undefined;
        }
        if (i.text !== undefined && typeof i.text !== 'boolean')
            fail(`${iw}text must be a boolean`);
        const text = i.text === true ? true : undefined;
        if (!options && !text)
            fail(`${w}input needs options or text`);
        input = compact({ label: inputLabel, options, text });
    }
    return compact({ id, label, path: p, confirm, input });
}
function parseActions(o) {
    return o.actions === undefined ? undefined : array(o, 'actions', '').map((a, i) => parseAction(a, `actions[${i}]`));
}
function parseRow(raw, index) {
    const where = `rows[${index}]`;
    const o = object(raw, where);
    const w = `${where}.`;
    const actions = o.actions === undefined ? undefined : array(o, 'actions', w).map((a, i) => parseAction(a, `${where}.actions[${i}]`));
    return compact({
        id: str(o, 'id', w),
        title: str(o, 'title', w),
        subtitle: optStr(o, 'subtitle', w),
        status: optOneOf(o, 'status', ROW_STATUSES, w),
        open: optPath(o, 'open', w),
        actions
    });
}
function parseBar(raw, index) {
    const where = `bars[${index}]`;
    const o = object(raw, where);
    const w = `${where}.`;
    if (!isFiniteNumber(o.percent))
        fail(`${w}percent must be a number`);
    if (o.resetsAt !== undefined && !isDateString(o.resetsAt))
        fail(`${w}resetsAt must be an ISO-8601 date`);
    return compact({
        label: str(o, 'label', w),
        percent: Math.min(100, Math.max(0, o.percent)),
        resetsAt: o.resetsAt
    });
}
function parseData(render, o) {
    if (!isDateString(o.updatedAt))
        fail('updatedAt must be an ISO-8601 date');
    const updatedAt = o.updatedAt;
    switch (render) {
        case 'stat': {
            const value = o.value;
            if (!(typeof value === 'string' || isFiniteNumber(value)))
                fail('value must be a number or a string');
            return compact({
                updatedAt,
                value: value,
                unit: optStr(o, 'unit', ''),
                caption: optStr(o, 'caption', ''),
                tone: optOneOf(o, 'tone', TONES, ''),
                actions: parseActions(o)
            });
        }
        case 'gauge': {
            const bars = array(o, 'bars', '').map(parseBar);
            if (bars.length === 0)
                fail('bars must hold at least one bar');
            return compact({ updatedAt, bars, actions: parseActions(o) });
        }
        case 'list': {
            if (o.total !== undefined && !isFiniteNumber(o.total))
                fail('total must be a number');
            return compact({ updatedAt, rows: array(o, 'rows', '').map(parseRow), total: o.total });
        }
        case 'status':
            return compact({
                updatedAt,
                state: oneOf(o, 'state', STATES, ''),
                label: str(o, 'label', ''),
                detail: optStr(o, 'detail', ''),
                actions: parseActions(o)
            });
        default:
            return fail(`unknown render ${JSON.stringify(render)}`);
    }
}
function validateData(render, raw) {
    try {
        return { ok: true, data: parseData(render, object(raw, 'data')) };
    }
    catch (e) {
        if (e instanceof Invalid)
            return { ok: false, reason: e.message };
        throw e;
    }
}
