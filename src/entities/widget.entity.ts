import { define } from 'mnemonica';
import type { MvpWidget, MvpWidget_WidgetLabel } from '../../.tactica/types';

/**
 * MvpWidget — the type behind POST /mvp/widget, where the adapter's
 * MnemonicaValidationPipe (mvp.forType) validates the body against
 * CreateWidgetDto and then constructs this type from it.
 */
const Widget = define('MvpWidget', function (this: MvpWidget, data: { name: string; addr: { city: string } }) {
	this.name = data.name;
	this.addr = data.addr;
});

/**
 * WidgetLabel — a subtype built FROM the pipe's instance
 * (`new widget.WidgetLabel(...)`): name and addr arrive through the
 * prototype chain, the constructor adds only what the label itself owns.
 */
Widget.define('WidgetLabel', function (this: MvpWidget_WidgetLabel, data: { format: 'short' | 'full' }) {
	this.format = data.format;
	this.text = data.format === 'short'
		? this.name
		: `${this.name} — ${this.addr.city}`;
});
