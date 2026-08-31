import { define, lookup } from 'mnemonica';
import { wrap } from '@mnemonica/dive';

const UserEntity = lookup('UserEntity');

/**
 * EDS Probe — exists for tactica's AoT analysis, never constructed at
 * runtime. The wrap() call sits INSIDE a define() handler, so tactica
 * resolves its EDS scope to EdsProbe (a graph node) instead of the
 * module-level 'unknown' scope the controllers get. The wrapped body
 * constructs UserEntity, yielding createsTypes: ['UserEntity'] — the
 * one fixture case where a path-hit edge has BOTH ends in the type
 * graph (EdsProbe → UserEntity), which mnemographica renders as the
 * cyan path-hit overlay.
 */
const EdsProbe = define('EdsProbe', function (this: { note: string }, data: { note: string }) {
	this.note = data.note;
	const fire = wrap((id: string) => {
		const user = new UserEntity({
			id,
			email: `${id}@probe.local`,
			name: `probe-${id}`,
		});
		const result = user.id;
		return result;
	}, 'probe:fire');
	// AoT-only: the wrap must exist in the handler body for tactica's
	// scope resolution; it is never invoked.
	void fire;
});

export { EdsProbe };
