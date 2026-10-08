// Package entry: the contract v1 validator and types, the producer, and the reference examples. The test kit is its own entry, `lookout-widgets/testkit`.
export * from './contract/types.js';
export { validateCatalog, validateData } from './contract/validate.js';
export { isRelativePath } from './contract/paths.js';
export { examples } from './examples/index.js';
export { actionPath, buildCatalog, catalogPath, dataPath, optionsPath, rowActionPath } from './producer/build.js';
export { createHubHandler } from './producer/handler.js';
