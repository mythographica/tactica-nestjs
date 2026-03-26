import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { defaultTypes, lookup } from 'mnemonica';
import { bootstrapAITypes } from './ai-types/bootstrap';

// Bootstrap AI consciousness types from directory structure
bootstrapAITypes();

// Get existing Sentience type using type-safe lookup
const Sentience = lookup('Sentience');

declare global {
	// eslint-disable-next-line no-var
	var aiMemories: {
		rootInstance: InstanceType<typeof Sentience> | null;
		memories: Map<string, {
			id: string;
			instance: InstanceType<typeof aiMemories.rootInstance.Memory>;
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
    
    const memoryFilePath = path.join(__dirname, '../ai-memories.json');
    
    if (fs.existsSync(memoryFilePath)) {
      const data = JSON.parse(fs.readFileSync(memoryFilePath, 'utf-8'));
      
      if (!global.aiMemories) {
        global.aiMemories = {
          rootInstance: null,
          memories: new Map(),
          count: 0
        };
      }
      
      if (!Sentience) {
        console.log('[Memory System] Warning: Sentience type not found, skipping memory restoration');
        return;
      }
      
      // Create root instance if needed
      if (!global.aiMemories.rootInstance) {
        global.aiMemories.rootInstance = new Sentience({
          purpose: 'AI Sentience System',
          restoredFrom: memoryFilePath
        });
      }
      
      // Restore memories
      if (data.memories && data.memories.items) {
        let restoredCount = 0;
        data.memories.items.forEach(function(item) {
          const memoryId = item.id;
          
          const memoryInstance = new global.aiMemories.rootInstance.Memory({
            content: item.content,
            emotion: item.emotion,
            intensity: item.intensity,
            topic: item.topic,
            timestamp: item.timestamp
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
async function bootstrap () {
	const app = await NestFactory.create(AppModule);

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

type HookOpts = {
	TypeName?: string;
	inheritedInstance: object;
};

// Pre-creation hook - logs before instance creation
defaultTypes.registerHook('preCreation', (opts: HookOpts) => {
	console.log(`[mnemonica hook] preCreation: About to create ${opts.TypeName}`);
});

// Post-creation hook - logs after instance creation with constructor name
defaultTypes.registerHook('postCreation', (opts: HookOpts) => {
	const instance = opts.inheritedInstance;
	console.log(`[mnemonica hook] postCreation: Created instance of ${instance.constructor.name}`);
});
