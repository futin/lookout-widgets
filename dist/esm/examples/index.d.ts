import type { Catalog, GaugeData, ListData, StatData, StatusData } from '../contract/types.js';
export declare const examples: {
    catalogs: {
        full: Catalog;
        empty: Catalog;
    };
    data: {
        queue: StatData;
        usage: GaugeData;
        runs: ListData;
        health: StatusData;
    };
};
