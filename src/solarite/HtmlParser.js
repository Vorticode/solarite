
export default class HtmlParser {
	constructor() {
		this.defaultState = {
			context: HtmlParser.Text, // possible values: 'TEXT', 'TAG', 'ATTRIBUTE'
			quote: null, // possible values: null, '"', "'"
			buffer: '',
			lastChar: null
		};
		this.state = {...this.defaultState};
	}

	reset() {
		this.state = {...this.defaultState};
		return this.state.context;
	}

	/**
	 * Parse the next chunk of html, starting with the same context we left off with from the previous chunk.
	 * @param html {string}
	 * @param onContextChange {?function(html:string, index:int, oldContext:string, newContext:string)}
	 *     Called every time the context changes, and again at the last context.
	 * @return {('Attribute','Text','Tag')} The context at the end of html.  */
	parse(html, onContextChange=null) {
		if (html === null)
			return this.reset();

		for (let i = 0; i < html.length; i++) {
			const char = html[i];
			switch (this.state.context) {
				case HtmlParser.Text:
					if (char === '<' && html[i + 1].match(/[/a-z!]/i)) { // Start of a tag or comment.
						onContextChange?.(html, i, this.state.context, HtmlParser.Tag);
						this.state.context = HtmlParser.Tag;
						this.state.buffer = '';
					}
					break;
				case HtmlParser.Tag:
					if (char === '>') {
						onContextChange?.(html, i+1, this.state.context, HtmlParser.Text);
						this.state.context = HtmlParser.Text;
						this.state.quote = null;
						this.state.buffer = '';
					}
					else if (char === ' ' && !this.state.buffer) {
						// No attribute name is present. Skipping the space.
						continue;
					}
					else if (char === ' ' || char === '/' || char === '?') {
						this.state.buffer = ''; // Reset the buffer when a delimiter or potential self-closing sign is found.
					}
					else if (char === '"' || char === "'" || char === '=') {
						onContextChange?.(html, i, this.state.context, HtmlParser.Attribute);
						this.state.context = HtmlParser.Attribute;
						this.state.quote = char === '=' ? null : char;
						this.state.buffer = '';
					}
					else
						this.state.buffer += char;
					break;
				case HtmlParser.Attribute:
					// Start an attribute quote.
					if (!this.state.quote && !this.state.buffer.length && (char === '"' || char === "'")) {
						this.state.quote = char;
					}
					else if (char === this.state.quote || (!this.state.quote && this.state.buffer.length)) {
						onContextChange?.(html, i, this.state.context, HtmlParser.Tag);
						this.state.context = HtmlParser.Tag;
						this.state.quote = null;
						this.state.buffer = '';
					}
					else if (!this.state.quote && char === '>') {
						onContextChange?.(html, i+1, this.state.context, HtmlParser.Text);
						this.state.context = HtmlParser.Text;
						this.state.quote = null;
						this.state.buffer = '';
					}
					else if (char !== ' ')
						this.state.buffer += char;

					break;
			}
		}
		onContextChange?.(html, html.length, this.state.context, null);
		return this.state.context;
	}
}

HtmlParser.Attribute = 'Attribute';
HtmlParser.Text = 'Text';
HtmlParser.Tag = 'Tag';