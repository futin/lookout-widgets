import type { HubHandler } from '../producer/handler.js';
export interface WidgetCase {
    widget: string;
    params: Record<string, string>;
}
/** Returns one line per failure, `[]` when every widget passes. Never throws. */
export declare function checkWidgets(handler: Pick<HubHandler, 'handle' | 'dropped'>, cases?: WidgetCase[]): Promise<string[]>;
