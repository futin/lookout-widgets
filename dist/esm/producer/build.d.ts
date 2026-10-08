import type { Catalog } from '../contract/types.js';
import type { AppInfo, WidgetDecl } from './declare.js';
export declare const catalogPath: () => string;
export declare const dataPath: (widgetId: string) => string;
export declare const optionsPath: (widgetId: string, paramId: string) => string;
export declare const actionPath: (widgetId: string, actionId: string) => string;
export declare const rowActionPath: (widgetId: string, rowId: string, actionId: string) => string;
/** Throws on a malformed or duplicate id, or a param with both `options` and `loadOptions` — programming errors, caught by the app's own tests. */
export declare function buildCatalog(app: AppInfo, decls: WidgetDecl[]): Catalog;
