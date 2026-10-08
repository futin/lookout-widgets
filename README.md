# lookout-widgets

Serve Lookout hub widgets from plain declarations. You describe each widget once (an id, a title, a render type and a `load` function); the package
derives every path, serves the catalog contract v1 and each widget's data, validates everything it serves against the same validator Lookout runs,
and gives your test suite one call that proves it.

Zero runtime dependencies. ESM and CommonJS. Node 20+.

## Install

From a git tag — `dist/` is committed, so nothing builds at install time:

```json
"dependencies": {
  "lookout-widgets": "github:futin/lookout-widgets#v0.1.0"
}
```

## Declare widgets

A declaration is a plain object. `render` picks the shape `load` must return: `stat` → `{ value }`, `gauge` → `{ bars }`, `list` → `{ rows }`,
`status` → `{ state }`. `load` may be async, and never returns `updatedAt` — the handler stamps it. Actions are declared once on the widget and named
by id from `load`'s result; the handler expands each id into a contract action with its derived path. Params arrive as a `Record<string, string>` of
the declared params the request supplied.

```ts
import { createHubHandler, type WidgetDecl } from 'lookout-widgets';

const usage: WidgetDecl = {
  id: 'usage',
  title: 'Usage',
  render: 'gauge',
  refreshSeconds: 60,
  load: async () => ({ bars: [{ label: '5-hour', percent: await fiveHourPercent() }] })
};

export const hub = createHubHandler({ app: { name: 'My app' }, widgets: [usage] });
```

`createHubHandler` throws on a malformed or duplicate id. A widget the contract validator would drop (an absolute `open`, say) is reported through
`onDrop` (default `console.warn`) and on `hub.dropped`, and is not served.

## Mount it

`hub.handle({ method, path, query, body })` resolves to `{ status, json }`, or to `null` when the request is not under `/api/hub/widgets` — fall
through to your own routes then. It never rejects. It does no authentication: guard the action routes (`POST`) the way you guard your own writes.

Pass the raw, still percent-encoded path: row ids travel encoded in action paths and the handler decodes them itself.

`node:http`:

```ts
http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const body = req.method === 'POST' ? await readJson(req) : undefined;
  const r = await hub.handle({ method: req.method ?? 'GET', path: url.pathname, query: url.searchParams, body });
  if (r === null) return next(req, res);
  res.writeHead(r.status, { 'content-type': 'application/json' }).end(JSON.stringify(r.json));
});
```

Express:

```ts
app.use(express.json(), async (req, res, next) => {
  const url = new URL(req.originalUrl, 'http://x');
  const r = await hub.handle({ method: req.method, path: url.pathname, query: url.searchParams, body: req.body });
  r === null ? next() : res.status(r.status).json(r.json);
});
```

NestJS:

```ts
@Controller('api/hub/widgets')
export class HubController {
  @All('*')
  async any(@Req() req: Request, @Res() res: Response) {
    const url = new URL(req.originalUrl, 'http://x');
    const r = await hub.handle({ method: req.method, path: url.pathname, query: url.searchParams, body: req.body });
    r === null ? res.status(404).end() : res.status(r.status).json(r.json);
  }
}
```

## Test it

```ts
import { checkWidgets } from 'lookout-widgets/testkit';

assert.deepEqual(await checkWidgets(hub, [{ widget: 'queries', params: { window: '1h' } }]), []);
```

`checkWidgets` fetches the catalog and every widget's data through the handler and validates each against the contract. It returns one line per
failure. A widget with a required param needs a case; every other widget is fetched once with no query.

## Versioning

The major version follows the contract. A contract bump is a new major of this package; minors and patches never change what Lookout accepts.

## License

MIT
