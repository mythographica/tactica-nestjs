import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as mnemonica from 'mnemonica';

/**
 * Graph Controller exposing mnemonica type hierarchy
 * Provides runtime type graph for comparison with CDP-retrieved data
 */
@ApiTags('graph')
@Controller('graph')
export class GraphController {

	/**
	 * Helper to safely get subtypes
	 */
	private getSubtypes (Type: any): any[] {
		const subtypes: any[] = [];
		try {
			if (Type && Type.subtypes) {
				Type.subtypes.forEach((SubType: any, name: string) => {
					try {
						subtypes.push({
							name,
							subtypes: this.getSubtypes(SubType)
						});
					} catch (e) {
						subtypes.push({ name, error: e.message });
					}
				});
			}
		} catch (e) {
			// Could not access subtypes
		}
		return subtypes;
	}

	/**
	 * Get the complete type hierarchy as plain text
	 * Returns text/plain for easy comparison with CDP-retrieved data
	 */
	@Get()
	@Header('Content-Type', 'text/plain')
	@ApiOperation({
		summary: 'Get mnemonica type hierarchy',
		description: 'Returns the complete type hierarchy as plain text for comparison with CDP data'
	})
	@ApiResponse({ status: 200, description: 'Type hierarchy retrieved successfully' })
	getGraph (): string {
		const defaultCollection = (mnemonica as any).defaultTypes;
		const hierarchy: any = {};

		// Get all types from the default collection
		if (defaultCollection && defaultCollection.subtypes) {
			defaultCollection.subtypes.forEach((Type: any, name: string) => {
				hierarchy[name] = {
					name,
					path: name,
					subtypes: this.getSubtypes(Type)
				};
			});
		}

		// Format as tree
		const formatTree = (obj: any, indent: string = ''): string => {
			let result = '';
			for (const key of Object.keys(obj)) {
				const node = obj[key];
				result += `${indent}${node.name}\n`;
				if (node.subtypes && node.subtypes.length > 0) {
					for (const sub of node.subtypes) {
						result += formatTree({ [sub.name]: sub }, indent + '  ');
					}
				}
			}
			return result;
		};

		// Also include JSON for programmatic access
		const output = [
			'=== MNEMONICA TYPE HIERARCHY ===',
			`Timestamp: ${new Date().toISOString()}`,
			`Total Types: ${Object.keys(hierarchy).length}`,
			'',
			'=== TREE VIEW ===',
			formatTree(hierarchy),
			'',
			'=== JSON ===',
			JSON.stringify(hierarchy, null, 2)
		].join('\n');

		return output;
	}

	/**
	 * Get the type hierarchy as JSON
	 */
	@Get('json')
	@ApiOperation({
		summary: 'Get mnemonica type hierarchy as JSON',
		description: 'Returns the complete type hierarchy as JSON'
	})
	@ApiResponse({ status: 200, description: 'Type hierarchy retrieved successfully' })
	getGraphJson (): any {
		const defaultCollection = (mnemonica as any).defaultTypes;
		const hierarchy: any = {};

		if (defaultCollection && defaultCollection.subtypes) {
			defaultCollection.subtypes.forEach((Type: any, name: string) => {
				hierarchy[name] = {
					name,
					path: name,
					subtypes: this.getSubtypes(Type)
				};
			});
		}

		return {
			success: true,
			hierarchy,
			typeCount: Object.keys(hierarchy).length,
			timestamp: new Date().toISOString()
		};
	}
}
