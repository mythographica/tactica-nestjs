import { Module } from '@nestjs/common';
import { UserController, AdminController, SuperAdminController } from './user.controller';
import { AsyncController } from './async.controller';
import { GraphController } from './graph.controller';
import { UserService } from './user.service';

/**
 * App Module bringing together controllers and services
 */
@Module({
	imports: [],
	controllers: [UserController, AdminController, SuperAdminController, AsyncController, GraphController],
	providers: [UserService],
})
export class AppModule {}
