import {Solarite, r} from './Solarite.min.js';
//import {Solarite, r} from '../../src/solarite/Solarite.js';
let debug2 = window.location.search.includes('debug');
let benchmark = window.location.search.includes('benchmark');

if (debug2) {
	window.getHtml = (item, includeComments=false) => {
		if (!item)
			return item;

		if (item.fragment)
			item = item.fragment; // Shell
		if (item instanceof DocumentFragment)
			item = [...item.childNodes]

		else if (item.getNodes)
			item = item.getNodes()

		let result;
		if (Array.isArray(item)) {
			if (!includeComments)
				item = item.filter(n => n.nodeType !==8)

			result = item.map(n => n.nodeType === 8 ? `<!--${n.textContent}-->` : n.outerHTML || n.textContent).join('|')
		}
		else
			result = item.outerHTML || item.textContent

		if (!includeComments)
			result = result.replace(/(<|\x3C)!--(.*?)-->/g, '')

		return result;
	}
}



let idCounter = 1;
const adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"],
	colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"],
	nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];

function _random (max) {
	return Math.round(Math.random() * 1000) % max
}

function buildData(count) {
	let data = new Array(count);
	for (let i = 0; i < count; i++) {
		data[i] = {
			id: idCounter++,
			label: `${adjectives[_random(adjectives.length)]} ${colours[_random(colours.length)]} ${nouns[_random(nouns.length)]}`
		}
	}
	return data;
}




class JSFrameworkBenchmark extends Solarite {
	data = [];

	constructor() {
		// Disable features we don't need, for performance.
		// At least until these new features are more performant.
		super({ids: false, scripts: false, styles: false})
	}

	// quickly mimic what the js-framework-benchmark does.
	// This is useful to see if performance changes after code modifications.
	benchmark(runs=1) {
		let times = [];
		let results = [];

		// Helper function to calculate geometric mean
		const geometricMean = (arr) => {
			return Math.pow(arr.reduce((a, b) => (a || .1) * (b || .1), 1), 1 / arr.length);
		};

		// Time the creation of rows
		for (let i=0; i<runs; i++) {
			let start = performance.now();
			this.data = buildData(1000);
			this.render();
			times.push(performance.now() - start);
			if (runs===1) console.log(`Create rows: ${times[times.length - 1]}ms`);

			// Time replacing all rows
			start = performance.now();
			this.data = buildData(1000);
			this.render();
			times.push(performance.now() - start);
			if (runs===1) console.log(`Replace all rows: ${times[times.length - 1]}ms`);

			// Time the partial update
			start = performance.now();
			let len = this.data.length;
			for (let i = 0; i < len; i += 10) {
				this.data[i].label += ' !!!';
			}
			this.render();
			times.push(performance.now() - start);
			if (runs===1) console.log(`Partial update: ${times[times.length - 1]}ms`);

			// Time selecting a row
			start = performance.now();
			this.data[1].selected = !this.data[1].selected;
			let modifications = this.render();
			times.push(performance.now() - start);
			if (runs===1) console.log(`Select row: ${times[times.length - 1]}ms`);

			// Time swapping rows
			start = performance.now();
			let temp = this.data[1];
			this.data[1] = this.data[998];
			this.data[998] = temp;
			this.render();
			times.push(performance.now() - start);
			if (runs===1) console.log(`Swap rows: ${times[times.length - 1]}ms`);

			// Time removing a row
			start = performance.now();
			this.data.splice(1, 1);
			this.render();
			times.push(performance.now() - start);
			if (runs===1) console.log(`Remove row: ${times[times.length - 1]}ms`);

			// Time creating many rows
			start = performance.now();
			this.data = buildData(10_000);
			this.render();
			times.push(performance.now() - start);
			if (runs===1) console.log(`Create many rows: ${times[times.length - 1]}ms`);

			// Time appending rows to large table
			start = performance.now();
			this.data.push(...buildData(1000));
			this.render();
			times.push(performance.now() - start);
			if (runs===1) console.log(`Append rows: ${times[times.length - 1]}ms`);

			// Time clearing rows
			start = performance.now();
			this.data = [];
			this.render();
			times.push(performance.now() - start);
			if (runs===1) console.log(`Clear rows: ${times[times.length - 1]}ms`);

			// Log the geometric mean of all steps
			const geoMean = geometricMean(times);
			results.push(geoMean);
			console.log(`Geometric mean: ${geoMean}ms`);
			times = [];
		}

		if (runs > 1) {
			console.log('---');
			let avg = results.reduce((a, b) => a + b) / results.length;
			console.log(`Min: ${Math.min(...results)}ms`);
			console.log(`Max: ${Math.max(...results)}ms`);
			console.log(`Avg: ${avg}ms`);
		}


	}

	run() {
		if (debug2)
			var start = performance.now();
		this.data = buildData(1000);
		let modifications = this.render()

		if (debug2) {
			console.log(performance.now() - start)
		}
	}

	runLots() {
		if (debug2)
			var start = performance.now();
		this.data = buildData(10_000);
		let modifications = this.render()

		if (debug2) {
			console.log(performance.now() - start)
		}
	}

	add() {
		if (debug2)
			var start = performance.now();

		this.data.push(...buildData(1000));
		let modifications = this.render();

		if (debug2) {
			console.log(performance.now() - start)
		}
	}

	update() {
		if (debug2)
			var start = performance.now();
		let len = this.data.length;
		for (let i=0; i<len; i+=10)
			this.data[i].label += ' !!!';

		this.render()

		if (debug2) {
			console.log(performance.now() - start)
		}
	}

	swapRows() {
		if (debug2)
			var start = performance.now();

		if (this.data.length > 998) {

			let temp = this.data[1];
			this.data[1] = this.data[998];
			this.data[998] = temp;
			var modifications = this.render()
		}

		if (debug2) {
			console.log(performance.now() - start)
		}
	}

	clear() {
		if (debug2)
			var start = performance.now();
		this.data = [];
		let modifications = this.render()

		if (debug2) {
			console.log(performance.now() - start)
		}
	}

	remove(id) {
		if (debug2)
			var start = performance.now();

		let index = this.data.findIndex(row=>row.id===id);

		this.data.splice(index, 1);
		let modifications = this.render();

		if (debug2) {
			console.log(performance.now() - start)
		}
	}

	setSelected(row) {
		if (debug2)
			var start = performance.now();

		// row.selected = !row.selected;
		// let modifications = this.render();

		row.selected = !row.selected;
		let modifications = this.render();

		if (debug2) {
			console.log(performance.now() - start)
		}
	}

	render() {
		let options = {ids: false, scripts: false, styles: false} // doesn't seem to make that much performance difference to disable these?
		r(this, options)`
		<div class="container">
			<div class="jumbotron">
				<div class="row">
					<div class="col-md-6">
						<h1>Solarite Keyed</h1>
					</div>
					<div class="col-md-6">
						<div class="row">
							<div class="col-sm-6 smallpad">
								<button id="run" class="btn btn-primary btn-block" type="button" 
									onclick=${this.run}>Create 1,000 rows</button>
							</div>
							<div class="col-sm-6 smallpad">
								<button id="runlots" class="btn btn-primary btn-block" type="button" 
									onclick=${this.runLots}>Create 10,000 rows</button>
							</div>
							<div class="col-sm-6 smallpad">
								<button id="add" class="btn btn-primary btn-block" type="button" 
									onclick=${this.add}>Append 1,000 rows</button>
							</div>
							<div class="col-sm-6 smallpad">
								<button id="update" class="btn btn-primary btn-block" type="button" 
									onclick=${this.update}>Update every 10th row</button>
							</div>
							<div class="col-sm-6 smallpad">
								<button id="clear" class="btn btn-primary btn-block" type="button" 
									onclick=${this.clear}>Clear</button>
							</div>
							<div class="col-sm-6 smallpad">
								<button id="swaprows" class="btn btn-primary btn-block" type="button" 
									onclick=${this.swapRows}>Swap Rows</button>
							</div>
						</div>
					</div>
				</div>
			</div>
			<table class="table table-hover table-striped test-data"><tbody>
				${this.data.map(row =>
					r`<tr class=${row.selected ? 'danger' : ''}>
						<td class="col-md-1">${row.id}</td>
						<td class="col-md-4">
							<a onclick=${[this.setSelected, row]}>${row.label}</a></td>
						<td class="col-md-1">
							<a onclick=${[this.remove, row.id]}>
								<span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a>
						</td>
						<td class="col-md-6"/>
					</tr>`
				)}
			</tbody></table>
		</div>`;

		return this.modifications;
	}
}

let app = new JSFrameworkBenchmark();
document.body.append(app);



if (benchmark)
	app.benchmark(50);

