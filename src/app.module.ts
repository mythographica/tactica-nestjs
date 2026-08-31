import { Module } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
// Side-effect imports: these modules call define() at load time.
// They MUST load before the controllers, whose module-level
// lookup() calls resolve types from the default collection.
import './entities/user.entity';
import './entities/async.entity';
import './entities/eds-probe.entity';
import { InferDebugModule } from 'infer-debug';
import { MnemonicaModule } from '@mnemonica/nestjs';
import { UserController, AdminController, SuperAdminController } from './user.controller';
import { AsyncController } from './async.controller';
import { GraphController } from './graph.controller';
import { ChaosController } from './chaos.controller';
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
		}),
	],
	controllers: [UserController, AdminController, SuperAdminController, AsyncController, GraphController, ChaosController],
	providers: [UserService],
})
export class AppModule {}
