import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type { NestModule, MiddlewareConsumer } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
// Side-effect imports: these modules call define() at load time.
// They MUST load before the controllers, whose module-level
// lookup() calls resolve types from the default collection.
import './entities/user.entity';
import './entities/async.entity';
import './entities/eds-probe.entity';
import { InferDebugModule } from 'infer-debug/nestjs';
import { MnemonicaModule } from '@mnemonica/nestjs';
import { UserController, AdminController, SuperAdminController } from './user.controller';
import { AsyncController } from './async.controller';
import { GraphController } from './graph.controller';
import { ChaosController } from './chaos.controller';
import { MarkInterceptor } from './mark.interceptor';
import { MidSleepMiddleware } from './mid-sleep.middleware';
import { MistPlusMiddleware } from './mist-plus.middleware';
import { CornerCutMiddleware } from './corner-cut.middleware';
import { StrategyChannelController } from './strategy-channel.controller';
import { UserService } from './user.service';

/**
 * App Module bringing together controllers and services
 */
@Module({
	// The app listens on process.env.PORT; the debug child must get its
	// own port (app port + 1) through the same variable.
	//
	// dive wiring comes from the real adapter (@mnemonica/nestjs) module
	// path: thunderstruck attaches dive hooks to the default collection
	// (create edges + method wrapping) and registers the pre-root
	// interceptor; tracer + traceDiveCalls attach both OTel providers
	// (construction spans + every wrapped call). The per-request HTTP span
	// (mtm) is registered in main.ts bootstrap, where the provider
	// instance is reachable via app.get().
	// The tracer proxy is safe at module scope: initTracing() ran first
	// (main.ts imports tracing before this module in compiled order).
	imports: [
		InferDebugModule.forRoot({ childPortEnvVar: 'PORT' }),
		MnemonicaModule.forRoot({
			tracer         : trace.getTracer('tactica-nestjs'),
			traceDiveCalls : true,
			thunderstruck  : true,
			// ALS backbone (adapter's async-flow.provider): unwrapped async
			// hops attribute to the parental dive edge; the crash handlers
			// below read currentFrame() for the failing fiber's context.
			asyncFlow      : true,
		}),
	],
	controllers: [UserController, AdminController, SuperAdminController, AsyncController, GraphController, ChaosController, StrategyChannelController],
	providers: [
		UserService,
		// Demo interceptor: stamps req.imark for the /chaos/crash_int_response
		// correlation table. Fixture-local, NOT part of the published adapter.
		{
			provide  : APP_INTERCEPTOR,
			useClass : MarkInterceptor,
		},
	],
})
export class AppModule implements NestModule {
	configure (consumer: MiddlewareConsumer): void {
		// The mid-sleep assassin: a middleware-established timer that throws
		// while the /chaos/mid_sleep handler is still sleeping. See
		// mid-sleep.middleware.ts for why the wrap happens at fire time.
		consumer.apply(MidSleepMiddleware).forRoutes('chaos/mid_sleep');
		// The queue producer: answers the awaited "remote reply" 100ms in,
		// with a payload that fails the sanity marker. Serves both sides of
		// the Nest-boundary demo: blindspot (default blind filter) and
		// unblinding (TraceExceptionFilter).
		consumer.apply(MistPlusMiddleware).forRoutes('chaos/blindspot', 'chaos/unblinding');
		// The fire-and-forget task + untyped req attachment: /chaos/corner_cut.
		consumer.apply(CornerCutMiddleware).forRoutes('chaos/corner_cut');
	}
}
