import { Controller, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { lookup, utils } from 'mnemonica';
import { mvp, getPreRoot } from '@mnemonica/nestjs';
import { CreateWidgetDto } from './dto/widget.dto';
import type { MvpWidget } from '../.tactica/types';

const MvpWidgetType = lookup('MvpWidget');

/**
 * The adapter's validation pipe in one route:
 *
 *   @Body(mvp.forType(MvpWidget, CreateWidgetDto))
 *
 * validates the body with class-validator (400 on failure), feeds the
 * validated DTO into the pre-root record the thunderstruck interceptor
 * opened for this request, then constructs MvpWidget from the body —
 * the handler receives a ready instance, no `new` in sight.
 *
 * The global ValidationPipe (main.ts) leaves this parameter alone: its
 * type is a mnemonica instance type, which reaches Nest as Object.
 */
@ApiTags('mvp')
@Controller('mvp')
export class MvpController {
	@Post('widget')
	@ApiOperation({
		summary     : 'Validate + construct via mvp.forType',
		description : 'The pipe validates CreateWidgetDto, links it to the pre-root record, and constructs MvpWidget',
	})
	@ApiBody({ type: CreateWidgetDto })
	@ApiResponse({ status: 201, description: 'The constructed MvpWidget and its pre-root record' })
	@ApiResponse({ status: 400, description: 'class-validator rejected the body' })
	createWidget (
		@Body(mvp.forType(MvpWidgetType, CreateWidgetDto)) widget: MvpWidget,
		@Req() req: Request,
	): object {
		// the body object the interceptor stamped resolves to its record
		const preRoot = getPreRoot(req.body);
		// the subtype is constructed from the pipe's instance: the label
		// reads name and addr off its parent through the prototype chain
		const label = new widget.WidgetLabel({ format: 'full' });
		const result = {
			type     : widget.constructor.name,
			instance : utils.extract(widget),
			label    : {
				type     : label.constructor.name,
				instance : utils.extract(label),
				isWidget : label instanceof MvpWidgetType,
			},
			preRoot  : {
				recorded  : preRoot !== undefined,
				validated : preRoot?.validated,
			},
		};
		return result;
	}
}
