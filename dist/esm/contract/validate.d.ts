import type { Catalog, RenderType, WidgetData } from './types.js';
export type Dropped = {
    widgetId: string | null;
    reason: string;
};
export type CatalogResult = {
    ok: true;
    catalog: Catalog;
    dropped: Dropped[];
} | {
    ok: false;
    reason: string;
};
export type DataResult = {
    ok: true;
    data: WidgetData;
} | {
    ok: false;
    reason: string;
};
export declare function validateCatalog(raw: unknown): CatalogResult;
export declare function validateData(render: RenderType, raw: unknown): DataResult;
