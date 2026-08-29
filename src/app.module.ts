import { Module } from '@nestjs/common';
// Side-effect imports: these modules call define() at load time.
// They MUST load before the controllers, whose module-level
// lookup() calls resolve types from the default collection.
import './entities/user.entity';
import './entities/async.entity';
import { InferDebugModule } from 'infer-debug';
import { UserController, AdminController, SuperAdminController } from './user.controller';
import { AsyncController } from './async.controller';
import { GraphController } from './graph.controller';
import { UserService } from './user.service';

/**
 * App Module bringing together controllers and services
 */
@Module({
	// The app listens on process.env.PORT; the debug child must get its
	// own port (app port + 1) through the same variable.
	//
	// dive wiring comes from the real adapter (@mnemonica/nestjs) —
	// attachHooks(defaultTypes) in main.ts. Its CJS build resolves
	// 'mnemonica/module' to core's CommonJS entry, so the earlier
	// ERR_REQUIRE_ASYNC_MODULE blocker is gone.
	imports: [
		InferDebugModule.forRoot({ childPortEnvVar: 'PORT' }),
	],
	controllers: [UserController, AdminController, SuperAdminController, AsyncController, GraphController],
	providers: [UserService],
})
export class AppModule {}
