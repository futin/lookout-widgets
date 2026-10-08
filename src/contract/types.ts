// Widget catalog contract v1 (spec §5). Imported by the server and the client; keep it free of runtime code.

export type RenderType = 'stat' | 'gauge' | 'list' | 'status';

export type Tone = 'ok' | 'warn' | 'error' | 'muted';
export type State = 'ok' | 'warn' | 'error' | 'idle';
export type RowStatus = 'ok' | 'warn' | 'error' | 'idle' | 'running';

export interface ParamOption {
  value: string;
  label: string;
}

export interface Param {
  id: string;
  label: string;
  type: 'choice' | 'text';
  /** Static choices. */
  options?: ParamOption[];
  /** Relative path returning `{ options: [...] }`. */
  optionsFrom?: string;
  optional?: boolean;
}

export interface Widget {
  id: string;
  title: string;
  render: RenderType;
  /** Relative path of the data endpoint. */
  data: string;
  /** Already clamped to 2-3600 once the catalog has been validated. */
  refreshSeconds: number;
  /** Relative deep link opened in the viewer when the tile is tapped. */
  open?: string;
  params?: Param[];
}

export interface Catalog {
  contract: 1;
  /** `icon` is a relative path to the app's own icon (rail spec §5); an invalid one is dropped, never fatal. */
  app: { name: string; icon?: string };
  widgets: Widget[];
}

export interface ActionInput {
  label: string;
  options?: string[];
  text?: boolean;
}

export interface Action {
  id: string;
  label: string;
  /** Relative path the hub POSTs to. */
  path: string;
  /** Prompt shown before sending. */
  confirm?: string;
  input?: ActionInput;
}

export interface Row {
  id: string;
  title: string;
  subtitle?: string;
  status?: RowStatus;
  /** Relative deep link. */
  open?: string;
  actions?: Action[];
}

export interface StatData {
  updatedAt: string;
  value: number | string;
  unit?: string;
  caption?: string;
  tone?: Tone;
  actions?: Action[];
}

export interface GaugeBar {
  label: string;
  /** Already clamped to 0-100 once validated. */
  percent: number;
  resetsAt?: string;
}

export interface GaugeData {
  updatedAt: string;
  bars: GaugeBar[];
  actions?: Action[];
}

export interface ListData {
  updatedAt: string;
  rows: Row[];
  total?: number;
}

export interface StatusData {
  updatedAt: string;
  state: State;
  label: string;
  detail?: string;
  actions?: Action[];
}

export type WidgetData = StatData | GaugeData | ListData | StatusData;
