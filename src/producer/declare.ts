// What an app writes to serve Lookout widgets: one declaration per widget. `buildCatalog` turns these into the contract catalog and `createHubHandler`
// serves them. Paths are never declared — they are derived (see build.ts), so they are relative by construction.
import type { ActionInput, Catalog, GaugeData, ListData, Param, ParamOption, RenderType, Row, StatData, StatusData } from '../contract/types.js';

export type MaybePromise<T> = T | Promise<T>;

export type AppInfo = Catalog['app'];

/** Param values a request supplied for the widget's declared params. An optional param that was not sent is absent. */
export type ParamValues = Record<string, string>;

/** A `load` result names actions by id; the handler expands each id into a contract `Action` with its derived path. */
type ActionIds = { actions?: string[] };

/** What `load` returns per render: the contract data shape without `updatedAt` (the handler stamps it), with action ids in place of actions. */
export interface LoadResult {
  stat: Omit<StatData, 'updatedAt' | 'actions'> & ActionIds;
  gauge: Omit<GaugeData, 'updatedAt' | 'actions'> & ActionIds;
  list: Omit<ListData, 'updatedAt' | 'rows'> & { rows: (Omit<Row, 'actions'> & ActionIds)[] };
  status: Omit<StatusData, 'updatedAt' | 'actions'> & ActionIds;
}

export type ParamDecl = Omit<Param, 'optionsFrom'> & {
  /** Served at the param's derived options path. Exclusive with `options`. A value for this param reaches `load` unchecked. */
  loadOptions?: () => MaybePromise<ParamOption[]>;
};

export interface ActionReply {
  ok: boolean;
  message?: string;
}

export interface ActionDecl {
  id: string;
  label: string;
  confirm?: string;
  input?: ActionInput;
  /** `rowId` is undefined for a widget-level action. The handler does no authentication: the mounting app guards its own write routes. */
  run(input: string | undefined, rowId: string | undefined): MaybePromise<ActionReply>;
}

interface DeclBase {
  id: string;
  title: string;
  refreshSeconds: number;
  /** Relative deep link opened when the tile is tapped. */
  open?: string;
  params?: ParamDecl[];
  actions?: ActionDecl[];
}

/** Discriminated on `render`, so a gauge's `load` must return `{ bars }`. */
export type WidgetDecl = {
  [R in RenderType]: DeclBase & { render: R; load(params: ParamValues): MaybePromise<LoadResult[R]> };
}[RenderType];
