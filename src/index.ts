// Package entry: the contract v1 validator and types, the producer, and the reference examples. The test kit is its own entry, `lookout-widgets/testkit`.
export * from './contract/types.js';
export { validateCatalog, validateData, type CatalogResult, type DataResult, type Dropped } from './contract/validate.js';
export { isRelativePath } from './contract/paths.js';
export { examples } from './examples/index.js';
export { actionPath, buildCatalog, catalogPath, dataPath, optionsPath, rowActionPath } from './producer/build.js';
export type { ActionDecl, ActionReply, AppInfo, LoadResult, MaybePromise, ParamDecl, ParamValues, WidgetDecl } from './producer/declare.js';
export { createHubHandler, type HubHandler, type HubHandlerOptions, type HubReply, type HubRequest } from './producer/handler.js';
