/**
 * Adapter proof, standalone (no Nest boot): DiveOtelProvider spans a
 * construction NESTED under the live wrapped call that caused it —
 * one trace, two spans — exported to the real Jaeger via OTLP.
 * Deps resolve from this repo's node_modules; works with both the
 * published packages (use:public) and local links (use:local).
 *
 * Needs Jaeger up (strategy/tools/jaeger-v2.yaml, ports 16686/4318).
 * Run: npm run demo:trace
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const NM = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules');

const { trace } = require(`${NM}/@opentelemetry/api`);
const { BasicTracerProvider, BatchSpanProcessor } = require(`${NM}/@opentelemetry/sdk-trace-node`);
const { OTLPTraceExporter } = require(`${NM}/@opentelemetry/exporter-trace-otlp-http`);
const { resourceFromAttributes } = require(`${NM}/@opentelemetry/resources`);
const { ATTR_SERVICE_NAME } = require(`${NM}/@opentelemetry/semantic-conventions`);
const { DiveOtelProvider } = await import(`${NM}/@mnemonica/nestjs/build/index.js`);
const { wrap, recordCreation } = await import(`${NM}/@mnemonica/dive/build/index.js`);

const provider = new BasicTracerProvider({
	resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'adapter-create-demo' }),
	spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({
		url: 'http://localhost:4318/v1/traces',
	}))],
});
trace.setGlobalTracerProvider(provider);

new DiveOtelProvider().attach();

// Construction INSIDE a live wrapped call: the create edge's span must
// nest under the call's span (parentage via edge.parentId), not open a
// root trace of its own.
const makeEntity = wrap(function makeEntity () {
	const instance = { id: `demo-${Date.now()}` };
	recordCreation('DemoEntity', instance);
	return instance;
});

makeEntity();

provider.forceFlush().then(() => {
	console.log('flushed: trace = dive.call:makeEntity > dive.create:DemoEntity');
	process.exit(0);
});
