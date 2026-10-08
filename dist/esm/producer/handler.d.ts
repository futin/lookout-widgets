import { type Dropped } from '../contract/validate.js';
import type { AppInfo, WidgetDecl } from './declare.js';
export interface HubRequest {
    method: string;
    /** Path without the query string. */
    path: string;
    query: URLSearchParams;
    body?: unknown;
}
export interface HubReply {
    status: number;
    json: unknown;
}
export interface HubHandler {
    /** `null` means the request is not ours — the app falls through to its own routes. Never rejects. */
    handle(req: HubRequest): Promise<HubReply | null>;
    /** Creation-time drops, also sent to `onDrop`. The served catalog is already normalised, so this is where a drop stays observable. */
    dropped: Dropped[];
}
export interface HubHandlerOptions {
    app: AppInfo;
    widgets: WidgetDecl[];
    onDrop?: (d: Dropped) => void;
    now?: () => Date;
}
/** Throws when the catalog as a whole is invalid — a programming error the app's own tests catch. */
export declare function createHubHandler({ app, widgets, onDrop, now }: HubHandlerOptions): HubHandler;
