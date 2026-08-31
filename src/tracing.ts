import { trace, context } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

/**
 * OpenTelemetry wiring for the dive execution flow.
 *
 * This file owns ONLY the SDK: provider + OTLP HTTP exporter to a local
 * Jaeger (docker run -p 16686:16686 -p 4318:4318 jaegertracing/jaeger with
 * strategy/tools/jaeger-v2.yaml). Span production is the adapter's job:
 * AppModule imports MnemonicaModule.forRoot({ tracer, traceDiveCalls,
 * thunderstruck }) — every HTTP request (mtm), wrapped call and
 * construction becomes a span, nested onto the request's trace.
 * Strategy replays those spans into mnemographica as a postmortem trace.
 *
 * Must be imported BEFORE anything that constructs wrapped instances.
 */
export function initTracing (): void {
	const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
	const exporter = new OTLPTraceExporter({
		url: `${endpoint}/v1/traces`,
	});

	const provider = new BasicTracerProvider({
		resource: resourceFromAttributes({
			[ATTR_SERVICE_NAME]: 'tactica-nestjs',
		}),
		spanProcessors: [new BatchSpanProcessor(exporter)],
	});
	// SDK 2.x dropped provider.register(); set the global explicitly.
	trace.setGlobalTracerProvider(provider);

	// setGlobalTracerProvider registers ONLY the tracer — without a global
	// context manager, otelContext.with() is a no-op and context.active()
	// stays ROOT forever. The adapter's middleware enters the OTEL global
	// context per request so dive's boundary spans (DiveOtelProvider reads
	// trace.getSpan(otelContext.active())) adopt the request span; that
	// propagation dies silently unless the manager is registered here.
	const contextManager = new AsyncLocalStorageContextManager();
	contextManager.enable();
	context.setGlobalContextManager(contextManager);

	console.log(`[tracing] OTLP spans exporting to ${endpoint} (service: tactica-nestjs)`);
}
