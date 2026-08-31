import 'reflect-metadata';
// OTEL must register before any wrapped construction records an edge.
import { initTracing } from './tracing';
initTracing();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { defaultTypes, lookup, utils } from 'mnemonica';
import type { hooksOpts } from 'mnemonica';
import { MnemonicaOtelProvider, MnemonicaTraceMiddleware } from '@mnemonica/nestjs';
import { getFlow, getErrorInstance } from '@mnemonica/dive';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';
import '../.tactica/registry'; // Augments mnemonica's TypeRegistry
import { bootstrapAITypes } from './ai-types/bootstrap';
import type { Sentience, Sentience_Memory } from '../.tactica/types';

// Bootstrap AI consciousness types from directory structure
bootstrapAITypes();

// Get existing Sentience type using type-safe lookup
const SentienceConstructor = lookup('Sentience');

declare global {
	// eslint-disable-next-line no-var
	var aiMemories: {
		rootInstance: Sentience | null;
		memories: Map<string, {
			id: string;
			instance: Sentience_Memory;
			createdAt: string;
		}>;
		count: number;
	};
}

// Restore memories from persistence file on startup
function restoreMemoriesOnStartup() {
	try {
		const fs = require('fs');
		const path = require('path');

		// dist/src/main.js -> ../../ is the project root
		const memoryFilePath = path.join(__dirname, '../../ai-memories.json');

		if (fs.existsSync(memoryFilePath)) {
			const data = JSON.parse(fs.readFileSync(memoryFilePath, 'utf-8'));

			if (!global.aiMemories) {
				global.aiMemories = {
					rootInstance: null,
					memories: new Map(),
					count: 0
				};
			}

			if (!SentienceConstructor) {
				console.log('[Memory System] Warning: Sentience type not found, skipping memory restoration');
				return;
			}

			// Create root instance if needed
			if (global.aiMemories.rootInstance === null) {
				global.aiMemories.rootInstance = new SentienceConstructor({
					awareness: 'AI Sentience System',
					identity: 'AI Agent'
				});
			}

			// Restore memories
			if (data.memories && data.memories.items) {
				let restoredCount = 0;
				data.memories.items.forEach(function (item) {
					const memoryId = item.id;

					const memoryInstance = new global.aiMemories.rootInstance.Memory({
						content: item.content,
						emotion: item.emotion,
						intensity: item.intensity,
						topic: item.topic
					});

					global.aiMemories.memories.set(memoryId, {
						id: memoryId,
						instance: memoryInstance,
						createdAt: item.createdAt || new Date().toISOString()
					});

					restoredCount++;
				});

				global.aiMemories.count = restoredCount;
				console.log(`[Memory System] Restored ${restoredCount} memories from ${memoryFilePath}`);
			}
		} else {
			console.log('[Memory System] No persistence file found, starting fresh');
		}
	} catch (e) {
		console.error('[Memory System] Error restoring memories:', e.message);
	}
}

// Restore memories on startup
restoreMemoriesOnStartup();

/**
 * NestJS Bootstrap with Swagger
 * Demonstrates integration with mnemonica and typeomatica
 */
async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Per-request OTel span (the adapter's mtm): this is the span the dive
	// branch and the construction spans nest under, so one HTTP request
	// reads as ONE joined trace in Jaeger. Constructed manually — the
	// middleware's Tracer parameter is an interface type, so Nest's DI
	// cannot resolve it (design:paramtypes collapses it to Object).
	const otel = app.get(MnemonicaOtelProvider, { strict: false });
	const mtm = new MnemonicaTraceMiddleware(trace.getTracer('tactica-nestjs'), otel);
	app.use((req: Request, res: Response, next: NextFunction) => mtm.use(req, res, next));

	// Enable global validation pipe
	app.useGlobalPipes(new ValidationPipe({
		transform: true,
		whitelist: true,
		forbidNonWhitelisted: true,
	}));

	// Setup Swagger
	const config = new DocumentBuilder()
		.setTitle('NestJS + Mnemonica Example')
		.setDescription('Example API demonstrating NestJS with mnemonica runtime inheritance')
		.setVersion('1.0')
		.addTag('users', 'User management')
		.addTag('admins', 'Admin management with inheritance')
		.addTag('super-admins', 'SuperAdmin management with 3-level inheritance')
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api-docs', app, document);

	const port = process.env.PORT || 3000;
	await app.listen(port);

	console.log(`NestJS server running on http://localhost:${port}`);
	console.log(`Swagger API docs available at http://localhost:${port}/api-docs`);
	console.log('');
	console.log('Available endpoints:');
	console.log('  POST /users           - Create user');
	console.log('  GET  /users/:id       - Get user');
	console.log('  POST /admins          - Create admin (with inheritance)');
	console.log('  GET  /admins/:id      - Get admin');
	console.log('  POST /super-admins    - Create superadmin (3-level inheritance)');
	console.log('  GET  /super-admins/:id - Get superadmin');
	console.log('');
	console.log('Async/Await + @decorate() Examples:');
	console.log('  POST /async/root-async              - Async constructor');
	console.log('  POST /async/root-async/result       - Async chain (RootAsync -> ResultFromDecorate)');
	console.log('  POST /async/sync-base/sub-async     - @decorate() class with async sub-type');
	console.log('  POST /async/sync-base/sub-async/sub-decorate - Full async chain with decorate');
}

bootstrap();

// Register mnemonica hooks for the default collection
// These hooks log constructor names when instances are created

// Dive lifecycle wiring lives in the adapter module path now:
// MnemonicaModule.forRoot({ thunderstruck: true }) in AppModule calls
// attachHooks(defaultTypes) itself (and registers the pre-root
// interceptor), so every construction records a 'create' edge in dive's
// execution-flow trace (dumpable live via strategy's rpc_dive_trace).

// Process-level error handlers for the chaos endpoints.
//
// Listeners keep the process ALIVE under sustained load (Node only exits on
// uncaughtException/unhandledRejection when nobody listens). Each handler
// reconstructs the failing branch from dive's flight recorder and enriches
// the report with the pinned instance's plain-data fields via mnemonica's
// extract() — one structured JSON line per failure for downstream tooling.
// Process-level failures usually escape the request's OTEL context (the throw
// crosses setImmediate / a dangling promise). With tracing.ts registering a
// global AsyncLocalStorage context manager, a failure that stays inside the
// request's async resource now parents onto the request span automatically;
// one that truly escapes still emits as a one-shot root span: ERROR status +
// the recorded exception, so Jaeger's error search (with_errors) finds them.
function recordProcessErrorSpan(kind: string, error: Error, branch: string[]) {
	const span = trace.getTracer('tactica-nestjs').startSpan(`process.${kind}`);
	span.setAttribute('process.error.kind', kind);
	span.setAttribute('dive.branch', branch.join(' → '));
	span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
	span.recordException(error);
	span.end();
}

process.on('uncaughtException', (error: Error) => {
	const flow = getFlow(error);
	const instance = getErrorInstance(error);
	const report = {
		kind: 'uncaughtException',
		message: error.message,
		branch: flow.map((edge) => `${edge.kind}:${edge.name}`),
		instance: instance ? utils.extract(instance) : null,
	};
	console.log(`[chaos] ${JSON.stringify(report)}`);
	recordProcessErrorSpan(report.kind, error, report.branch);
});

process.on('unhandledRejection', (reason: unknown) => {
	const error = reason instanceof Error ? reason : new Error(String(reason));
	const flow = getFlow(error);
	const instance = getErrorInstance(error);
	const report = {
		kind: 'unhandledRejection',
		message: error.message,
		branch: flow.map((edge) => `${edge.kind}:${edge.name}`),
		instance: instance ? utils.extract(instance) : null,
	};
	console.log(`[chaos] ${JSON.stringify(report)}`);
	recordProcessErrorSpan(report.kind, error, report.branch);
});

// Pre-creation hook - logs before instance creation
defaultTypes.registerHook('preCreation', (opts: hooksOpts) => {
	console.log(`[mnemonica hook] preCreation: About to create ${opts.TypeName}`);
});

// Post-creation hook - logs after instance creation with constructor name
defaultTypes.registerHook('postCreation', (opts: hooksOpts) => {
	const instance = opts.inheritedInstance;
	console.log(`[mnemonica hook] postCreation: Created instance of ${instance?.constructor.name}`);
});
