/**
 * @typedef {Array|function(...*)} Callbacks
 * @property {function(function)} push
 * @property {function()} remove
 * @property {function()} pause
 * @property {function()} resume
 * */


/**
 * A place for functions that have no other home. */
var Util$1 = {

	/**
	 * Create an array-like object that stores a group of callbacks.
	 * Supports all array functions and properties like push() and .length.
	 * Can be called directly.
	 *
	 * @param functions {function[]}
	 * @return {Callbacks|function}
	 *
	 * @example
	 * var c = Util.callback();
	 * var f = () => console.log(3);
	 * c.push(f);
	 * c();
	 * c.remove(f);
	 * c();
	 */
	callback(...functions) {
		var paused = false;

		// Make it callable.  When we call it, call all callbacks() with the given args.
		let result = async function(...args) {
			let result2 = [];
			if (!paused)
				for (let i=0; i<result.length; i++)
					result2.push(result[i](...args));
			return await Promise.all(result2);
		};
		
		// Make it iterable.
		result[Symbol.iterator] = function() {
			let index = 0;
			return {
				next: () => index < result.length
					 ? {value: result[index++], done: false}
					 : {done: true}
			};
		};

		// Use properties from Array
		for (let prop of Object.getOwnPropertyNames(Array.prototype))
			if (prop !== 'length' && prop !== 'constructor')
				result[prop] = Array.prototype[prop];

		result.l = 0; // Internal length
		Object.defineProperty(result, 'length', {
			get() { return result.l },
			set(val) { result.l = val;}
		});

		// Add the remove() function.
		result.remove = func => {
			let idx = result.findIndex(item => item === func);
			if (idx !== -1)
				result.splice(idx, 1);
		};
		result.pause = () => paused = true;

		result.resume = () => paused = false;

		// Add initial functions
		for (let f of functions)
			result.push(f);

		return result;
	},

	/**
	 * Use an array as the value of a map, appending to it when we add.
	 * Used by watch3.js.
	 * @param map {Map|WeakMap|Object}
	 * @param key
	 * @param value */
	mapArrayAdd(map, key, value) {
		let isMap = map instanceof Map || map instanceof WeakMap;
		let result = isMap ? map.get(key) : map[key];
		if (!result) {
			result = [value];
			if (isMap)
				map.set(key, result);
			else
				map[key] = result;
		}
		else
			result.push(value);
	},

	weakMemoize(obj, callback) {
		let result = weakMemoizeInputs.get(obj);
		if (!result) {
			result = callback(obj);
			weakMemoizeInputs.set(obj, result);
		}
		return result;
	}
};

let weakMemoizeInputs = new WeakMap();

/**
 * Follow a path into an object.
 * @param obj {object}
 * @param path {string[]}
 * @param createVal {*}  If set, non-existent paths will be created and value at path will be set to createVal.
 * @return {*} The value, or undefined if it can't be reached. */
function delve(obj, path, createVal = delveDontCreate) {
	let isCreate = createVal !== delveDontCreate;

	let len = path.length;
	if (!obj && !isCreate && len)
		return undefined;

	let i = 0;
	for (let srcProp of path) {

		// If the path is undefined and we're not to the end yet:
		if (obj[srcProp] === undefined) {

			// If the next index is an integer or integer string.
			if (isCreate) {
				if (i < len - 1) {
					// If next level path is a number, create as an array
					let isArray = (path[i + 1] + '').match(/^\d+$/);
					obj[srcProp] = isArray ? [] : {};
				}
			} else
				return undefined; // can't traverse
		}

		// If last item in path
		if (isCreate && i === len - 1)
			obj[srcProp] = createVal;

		// Traverse deeper along destination object.
		obj = obj[srcProp];
		i++;
	}

	return obj;
}

let delveDontCreate = {};

/**
 * There are three ways to create an instance of a Solarite Component:
 * 1.  new ComponentName();                                         // direct class instantiation
 * 2.  this.html = r`<div><component-name></component-name></div>;  // as a child of another RedComponent.
 * 3.  <body><component-name></component-name></body>               // in the Document html.
 *
 * When created via #3, Solarite has no way to pass attributes as arguments to the constructor.  So to make
 * sure we get the correct value via all three paths, we write our constructors according to the following
 * example.  Note that constructor args are embedded in an object, and must be all lower-case because
 * Browsers make all html attribute names lowercase.
 *
 * @example
 * constructor({name, userid=1}={}) {
 *     super();
 *
 *     // Get value from "name" attriute if persent, otherwise from name constructor arg.
 *     this.name = getArg(this, 'name', name);
 *
 *     // Optionally convert the value to an integer.
 *     this.userId = getArg(this, 'userid', userid, ArgType.Int);
 * }
 *
 * @param el {HTMLElement}
 * @param attributeName {string} Attribute name.  Not case-sensitive.
 * @param defaultValue {*} Default value to use if attribute doesn't exist.
 * @param type {ArgType|function|*[]}
 *     If an array, use the value if it's in the array, otherwise return undefined.
 *     If it's a function, pass the value to the function and return the result.
 * @param fallback {*} If the defaultValue is undefiend and type can't be parsed as the given type, use this value.
 *     TODO: Should this be merged with the defaultValue argument?
 * @return {*} Undefined if attribute isn't set.  */
function getArg(el, attributeName, defaultValue=undefined, type=ArgType.String, fallback=undefined) {
	let val = defaultValue;
	let attrVal = el.getAttribute(attributeName);
	if (attrVal !== null) // If attribute doesn't exist.
		val = attrVal;
		
	if (Array.isArray(type))
		return type.includes(val) ? val : fallback;
	
	if (typeof type === 'function')
		return type(val);
	
	// If bool, it's true as long as it exists and its value isn't falsey.
	if (type===ArgType.Bool) {
		let lAttrVal = typeof val === 'string' ? val.toLowerCase() : val;
		if (['false', '0', false, 0, null, undefined, NaN].includes(lAttrVal))
			return false;
		if (['true', true].includes(lAttrVal) || parseFloat(lAttrVal) !== 0)
			return true;
		return fallback;
	}
	
	// Attribute doesn't exist
	let result;
	switch (type) {
		case ArgType.Int:
			result = parseInt(val);
			return isNaN(result) ? fallback : result;
		case ArgType.Float:
			result = parseFloat(val);
			return isNaN(result) ? fallback : result;
		case ArgType.String:
			return [undefined, null, false].includes(val) ? '' : val+'';
		case ArgType.JSON:
		case ArgType.Eval:
			if (typeof val === 'string' && val.length)
				try {
					if (type === ArgType.JSON)
						return JSON.parse(val);
					else
						return eval(`(${val})`);
				} catch (e) {
					return val;
				}
			else return val;

		// type not provided
		default:
			return val;
	}
}

/**
 * @enum */
var ArgType = {
	
	/**
	 * false, 0, null, undefined, '0', and 'false' (case-insensitive) become false.
	 * Anything else, including empty string becomes true.
	 * Empty string is true because attributes with no value should be evaulated as true. */
	Bool: 'Bool',
	
	Int: 'Int',
	Float: 'Float',
	String: 'String',
	
	/**
	 * Parse the string value as JSON.
	 * If it's not parsable, return the value as a string. */
	JSON: 'JSON',
	
	/**
	 * Evaluate the string as JavaScript using the eval() function.
	 * If it can't be evaluated, return the original string. */
	Eval: 'Eval'
};

let lastObjectId = 1>>>0; // Is a 32-bit int faster to increment than JavaScript's Number, which is a 64-bit float?
let objectIds = new WeakMap();

/**
 * @param obj {Object|string|Node}
 * @returns {string} */
function getObjectId(obj) {
	// if (typeof obj === 'function')
	// 	return obj.toString(); // This fails to detect when a function's bound variables changes.
	
	let result = objectIds.get(obj);
	if (!result) { // convert to string, store in result, then add 1 to lastObjectId.
		result = '~\f' + (lastObjectId++); // We use a unique, 2-byte prefix to ensure it doesn't collide w/ strings not from getObjectId()
		objectIds.set(obj, result);
	}
	return result;
}

/**
 * Control how JSON.stringify() handles Nodes and Functions.
 * Normally, we'd pass a replacer() function argument to JSON.stringify() to handle Nodes and Functions.
 * But that makes JSON.stringify() take twice as long to run.
 * Adding a toJSON method globally on these object prototypes doesn't incur that performance penalty. */
let isHashing = true;
function toJSON() {
	return isHashing ? getObjectId(this) : this
}


// Node.prototype.toJSON = toJSON;
// Function.prototype.toJSON = toJSON;


/**
 * Get a string that uniquely maps to the values of the given object.
 * If a value in obj changes, calling getObjectHash(obj) will then return a different hash.
 * This is used by NodeGroupManager to create a hash that represents the current values of a NodeGroup.
 *
 * Relies on the Node and Function prototypes being overridden above.
 *
 * Note that passing an integer may collide with the number we get from hashing an object.
 * But we don't handle that case because we need max performance and Solarite never passes integers to this function.
 *
 * @param obj {*}
 * @returns {string} */
function getObjectHash(obj) {

	// Sometimes these get unassigned by Chrome and Brave 119, as well as Firefox, seemingly randomly!
	// The same tests sometimes pass, sometimes fail, even after browser and OS restarts.
	// So we check the assignments on every run of getObjectHash()
	if (Node.prototype.toJSON !== toJSON) {
		Node.prototype.toJSON = toJSON;
		if (Function.prototype.toJSON !== toJSON) // Will it only unmap one but not the other?
			Function.prototype.toJSON = toJSON;
	}

	let result;
	isHashing = true;
	try {
		result = JSON.stringify(obj);
	}
	catch(e) {
		result = getObjectHashCircular(obj);
	}
	isHashing = false;
	return result;
}

/**
 * Slower hashing method that supports.
 * @param obj
 * @returns {string} */
function getObjectHashCircular(obj) {

	//console.log('circular')
	// Slower version that handles circular references.
	// Just adding any callback at all, even one that just returns the value, makes JSON.stringify() twice as slow.
	const seen = new Set();
	return JSON.stringify(obj, (key, value) => {
		if (typeof value === 'object' && value !== null) {
			if (seen.has(value))
				return getObjectId(value);
			seen.add(value);
		}
		return value;
	});
}



var Globals;

/**
 * Created with a reset() function because it's useful for testing. */
function reset() {
	Globals = {

		/**
		 * Used by NodeGroup.applyComponentExprs() */
		componentArgsHash: new WeakMap(),

		/**
		 * Store which instances of Solarite have already been added to the DOM.
		 * @type {WeakSet<HTMLElement>} */
		connected: new WeakSet(),

		div: document.createElement("div"),

		/**
		 * Elements that have been rendered to by r() at least once.
		 * This is used by the Solarite class to know when to call onFirstConnect()
		 * @type {WeakSet<HTMLElement>} */
		rendered: new WeakSet(),

		/**
		 * Used by watch3 to see which expressions are being accessed.
		 * Set in ExprPath.applyExact()
		 * @type {ExprPath}*/
		currentExprPath: null,

		/**
		 * @type {Object<string, Class<Node>>} A map from built-in tag names to the constructors that create them. */
		elementClasses: {},

		/**
		 * Used by ExprPath.applyEventAttrib()
		 * @type {WeakMap<Node, Object<eventName:string, [original:function, bound:function, args:*[]]>>} */
		nodeEvents: new WeakMap(),

		/**
		 * Get the RootNodeGroup for an element.
		 * @type {WeakMap<HTMLElement, RootNodeGroup>} */
		nodeGroups: new WeakMap(),

		/**
		 * Used by r() path 9. */
		objToEl: new WeakMap(),

		//pendingChildren: [],

		/**
		 * Elements that are currently rendering via the r() function.
		 * @type {WeakSet<HTMLElement>} */
		rendering: new WeakSet(),

		/**
		 * Map from array of Html strings to a Shell created from them.
		 * @type {WeakMap<string[], Shell>} */
		shells: new WeakMap(),

		reset,
	};
}
reset();

var Globals$1 = Globals;

let Util = {

	/**
	 * @param style {HTMLStyleElement}
	 * @param root {HTMLElement} */
	bindStyles(style, root) {
		let styleId = root.getAttribute('data-style');
		if (!styleId) {
			// Keep track of one style id for each class.
			// TODO: Put this outside the class in a map, so it doesn't conflict with static properties.
			if (!root.constructor.styleId)
				root.constructor.styleId = 1;
			styleId = root.constructor.styleId++;

			root.setAttribute('data-style', styleId);
		}

		// Replace ":host" with "tagName[data-style=...]" in the css.
		let tagName = root.tagName.toLowerCase();
		for (let child of style.childNodes) {
			if (child.nodeType === 3) {
				let oldText = child.textContent;
				let newText = oldText.replace(/:host(?=[^a-z0-9_])/gi, `${tagName}[data-style="${styleId}"]`);
				if (oldText !== newText)
					child.textContent = newText;
			}
		}
	},


	/**
	 * Converts a string written in kebab-case to camelCase.
	 *
	 * @param {string} str - The input string written in kebab-case.
	 * @return {string} - The resulting camelCase string.
	 *
	 * @example
	 * dashesToCamel('example-string') // Returns 'exampleString'
	 * dashesToCamel('another-example-test') // Returns 'anotherExampleTest' */
	dashesToCamel(str) {
		return str.replace(/-([a-z])/g, g => g[1].toUpperCase());
	},


	/**
	 * A generator function that recursively traverses and flattens a value.
	 *
	 * - If the input is an array, it recursively traverses and flattens the array.
	 * - If the input is a function, it calls the function, replaces the function
	 *   with its result, and flattens the result if necessary. It will recursively
	 *   call functions that return other functions.
	 * - Otherwise it yields the value as is.
	 *
	 * This function does not create a new array for the flattened values. Instead,
	 * it lazily yields each item as it is encountered. This can be more memory-efficient
	 * for large or deeply nested structures.
	 *
	 * @param {any} value - The value to flatten. Can be an array, object, function, or primitive.
	 * @yields {any} - The next item in the flattened structure.
	 *
	 * @example
	 * const complexArray = [
	 *     1,
	 *     [2, () => 3, [4, () => [5, 6]], { a: 'object' }],
	 *     () => () => 7,
	 *     () => [() => 8, 9],
	 * ];	 *
	 * for (const item of flatten(complexArray))
	 *     console.log(item);  // Outputs: 1, 2, 3, 4, 5, 6, { a: 'object' }, 7, 8, 9
	 */
	*flatten(value) {
		if (Array.isArray(value)) {
			for (const item of value) {
				yield* Util.flatten(item);  // Recursively flatten arrays
			}
		} else if (typeof value === 'function') {
			const result = value();
			yield* Util.flatten(result);  // Recursively flatten the result of a function
		} else
			yield value;  // Yield primitive values as is
	},

	/**
	 * Get the value of an input as the most appropriate JavaScript type.
	 * @param node {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|HTMLDivElement}
	 * @return {string|string[]|number|[]|File[]|Date|boolean} */
	getInputValue(node) {
		// .type is a built-in DOM property
		if (node.type === 'checkbox' || node.type === 'radio')
			return node.checked; // Boolean
		if (node.type === 'file')
			return [...node.files]; // FileList
		if (node.type === 'number' || node.type === 'range')
			return node.valueAsNumber; // Number
		if (node.type === 'date' || node.type === 'time' || node.type === 'datetime-local')
			return node.valueAsDate; // Date Object
		if (node.type === 'select-multiple') // <select multiple>
			return [...node.selectedOptions].map(option => option.value); // Array of Strings

		return node.value; // String
	},

	/**
	 * Is it an array and a path that can be evaluated by delve() ?
	 * We allow the first element to be null/undefined so binding can report errors.
	 * @param arr {Array|*}
	 * @returns {boolean} */
	isPath(arr) {
		return Array.isArray(arr) && arr.length >=2 && (typeof arr[0] === 'object' || typeof arr[0] === 'undefined') && !arr.slice(1).find(p => typeof p !== 'string' && typeof p !== 'number');
	},

	isFalsy(val) {
		return val === undefined || val === false || val === null;
	},

	isPrimitive(val) {
		return typeof val === 'string' || typeof val === 'number'
	},

	/**
	 * Remove nodes from the beginning and end that are not:
	 * 1.  Elements.
	 * 2.  Non-whitespace text nodes.
	 * @param nodes {Node[]|NodeList}
	 * @returns {Node[]} */
	trimEmptyNodes(nodes) {
		const shouldTrimNode = node =>
			node.nodeType !== Node.ELEMENT_NODE &&
			(node.nodeType !== Node.TEXT_NODE || node.textContent.trim() === '');

		// Convert nodeList to an array for easier manipulation
		const result = [...nodes];

		// Trim from the start
		while (result.length > 0 && shouldTrimNode(result[0]))
			result.shift();

		// Trim from the end
		while (result.length > 0 && shouldTrimNode(result[result.length - 1]))
			result.pop();

		return result;
	}
};



let isEvent = attrName => attrName.startsWith('on') && attrName in Globals$1.div;


/**
 * Convert a Proper Case name to a name with dashes.
 * Dashes will be placed between letters and numbers.
 * If there are multiple consecutive capital letters followed by another chracater, a dash will be placed before the last capital letter.
 * @param str {string}
 * @return {string}
 *
 * @example
 * 'ProperName' => 'proper-name'
 * 'HTMLElement' => 'html-element'
 * 'BigUI' => 'big-ui'
 * 'UIForm' => 'ui-form'
 * 'A100' => 'a-100' */
function camelToDashes(str) {
	// Convert any capital letter that is preceded by a lowercase letter or number to lowercase and precede with a dash.
	str = str.replace(/([a-z0-9])([A-Z])/g, '$1-$2');

	// Convert any capital letter that is followed by a lowercase letter or number to lowercase and precede with a dash.
	str = str.replace(/([A-Z])([A-Z][a-z])/g, '$1-$2');

	// Convert any number that is preceded by a lowercase or uppercase letter to be preceded by a dash.
	str = str.replace(/([a-zA-Z])([0-9])/g, '$1-$2');

	// Convert all the remaining capital letters to lowercase.
	return str.toLowerCase();
}





/**
 * Returns true if they're the same.
 * @param a
 * @param b
 * @returns {boolean} */
function arraySame(a, b) {
	let aLength = a.length;
	if (aLength !== b.length)
		return false;
	for (let i=0; i<aLength; i++)
		if (a[i] !== b[i])
			return false;
	return true; // the same.
}





// For debugging only


class MultiValueMap {

	/** @type {Object<string, Set>} */
	data = {};

	// Set a new value for a key
	add(key, value) {
		let data = this.data;
		let set = data[key];
		if (!set) {
			set = new Set();
			data[key] = set;
		}
		set.add(value);
	}

	isEmpty() {
		for (let key in this.data)
			return true;
		return false;
	}

	/**
	 * Get all values for a key.
	 * @param key {string}
	 * @returns {Set|*[]} */
	getAll(key) {
		return this.data[key] || [];
	}

	/**
	 * Remove one value from a key, and return it.
	 * @param key {string}
	 * @param val If specified, make sure we delete this specific value, if a key exists more than once.
	 * @returns {*|undefined} The deleted item. */
	delete(key, val=undefined) {
		let data = this.data;
		let result;
		let set = data[key];
		if (!set)
			return undefined;

		// Delete any value.
		if (val === undefined) {
			[result] = set; // Does the same as above and seems to be about the same speed.
			set.delete(result);
		}

		// Delete a specific value.
		else {
			set.delete(val);
			result = val;
		}

		if (set.size === 0)
			delete data[key];

		return result;
	}

	/**
	 * Remove one value from a key, and return it.
	 * @param key {string}
	 * @param val If specified, make sure we delete this specific value, if a key exists more than once.
	 * @returns {*|undefined} The deleted item. */
	deleteAny(key, val=undefined) {
		let data = this.data;
		let result;
		let set = data[key];
		if (!set) // slower than pre-check.
			return undefined;

		[result] = set; // Does the same as above and seems to be about the same speed.
		set.delete(result);

		if (set.size === 0)
			delete data[key];

		return result;
	}

	deleteSpecific(key, val) {
		let data = this.data;
		let result;
		let set = data[key];
		if (!set)
			return undefined;

		set.delete(val);
		result = val;

		if (set.size === 0)
			delete data[key];

		return result;
	}


	/**
	 * Try to delete an item that matches the key and the isPreferred function.
	 * if not the latter, just delete any item that matches the key.
	 * @param key {string}
	 * @returns {*|undefined} The deleted item. */
	deletePreferred(key, parent) {
		let result;
		let data = this.data;
		let set = data[key];
		if (!set)
			return undefined;

		for (let val of set) {
			if (val?.parentNode === parent) {
				set.delete(val);
				result = val;
				break;
			}
		}
		if (!result) {
			[result] = set;
			set.delete(result);
		}

		if (set.size === 0)
			delete data[key];

		return result;
	}

	hasValue(val) {
		let data = this.data;
		let names = [];
		for (let name in data)
			if (data[name].has(val)) // TODO: iterate twice to pre-size array?
				names.push(name);
		return names;
	}
}

/**
 * ISC License
 *
 * Copyright (c) 2020, Andrea Giammarchi, @WebReflection
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
 * OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

/**
 * @param {Node} parentNode The container where children live
 * @param {Node[]} a The list of current/live children
 * @param {Node[]} b The list of future children
 * @param {(entry: Node, action: number) => Node} get
 * The callback invoked per each entry related DOM operation.
 * @param {Node} [before] The optional node used as anchor to insert before.
 * @returns {Node[]} The same list of future children.
 */
const udomdiff = (parentNode, a, b, before) => {
	

	const bLength = b.length;
	let aEnd = a.length;
	let bEnd = bLength;
	let aStart = 0;
	let bStart = 0;
	let map = null;
	while (aStart < aEnd || bStart < bEnd) {
		// append head, tail, or nodes in between: fast path
		if (aEnd === aStart) {
			// we could be in a situation where the rest of nodes that
			// need to be added are not at the end, and in such case
			// the node to `insertBefore`, if the index is more than 0
			// must be retrieved, otherwise it's gonna be the first item.
			const node = bEnd < bLength
				? (bStart
					? (b[bStart - 1].nextSibling)
					: b[bEnd - bStart])
				: before;
			while (bStart < bEnd) {
				let bNode = b[bStart++];
				parentNode.insertBefore(bNode, node);

				
			}
		}
		// remove head or tail: fast path
		else if (bEnd === bStart) {
			while (aStart < aEnd) {
				// remove the node only if it's unknown or not live
				let aNode = a[aStart];
				if (!map || !map.has(aNode)) {
					parentNode.removeChild(aNode);

					
				}
				aStart++;
			}
		}
		// same node: fast path
		else if (a[aStart] === b[bStart]) {
			aStart++;
			bStart++;
		}
		// same tail: fast path
		else if (a[aEnd - 1] === b[bEnd - 1]) {
			aEnd--;
			bEnd--;
		}
			// The once here single last swap "fast path" has been removed in v1.1.0
			// https://github.com/WebReflection/udomdiff/blob/single-final-swap/esm/index.js#L69-L85
		// reverse swap: also fast path
		else if (
			a[aStart] === b[bEnd - 1] &&
			b[bStart] === a[aEnd - 1]
		) {
			// this is a "shrink" operation that could happen in these cases:
			// [1, 2, 3, 4, 5]
			// [1, 4, 3, 2, 5]
			// or asymmetric too
			// [1, 2, 3, 4, 5]
			// [1, 2, 3, 5, 6, 4]
			const node = a[--aEnd].nextSibling;


			let a2 = b[bStart++];
			let b2 = a[aStart++];
			parentNode.insertBefore(
				a2,
				b2.nextSibling
			);
			

			let bNode = b[--bEnd];
			parentNode.insertBefore(bNode, node);

			

			// mark the future index as identical (yeah, it's dirty, but cheap 👍)
			// The main reason to do this, is that when a[aEnd] will be reached,
			// the loop will likely be on the fast path, as identical to b[bEnd].
			// In the best case scenario, the next loop will skip the tail,
			// but in the worst one, this node will be considered as already
			// processed, bailing out pretty quickly from the map index check
			a[aEnd] = b[bEnd];
		}
		// map based fallback, "slow" path
		else {
			// the map requires an O(bEnd - bStart) operation once
			// to store all future nodes indexes for later purposes.
			// In the worst case scenario, this is a full O(N) cost,
			// and such scenario happens at least when all nodes are different,
			// but also if both first and last items of the lists are different
			if (!map) {
				map = new Map;
				let i = bStart;
				while (i < bEnd)
					map.set(b[i], i++);
			}
			// if it's a future node, hence it needs some handling
			if (map.has(a[aStart])) {
				// grab the index of such node, 'cause it might have been processed
				const index = map.get(a[aStart]);
				// if it's not already processed, look on demand for the next LCS
				if (bStart < index && index < bEnd) {
					let i = aStart;
					// counts the amount of nodes that are the same in the future
					let sequence = 1;
					while (++i < aEnd && i < bEnd && map.get(a[i]) === (index + sequence))
						sequence++;
					// effort decision here: if the sequence is longer than replaces
					// needed to reach such sequence, which would brings again this loop
					// to the fast path, prepend the difference before a sequence,
					// and move only the future list index forward, so that aStart
					// and bStart will be aligned again, hence on the fast path.
					// An example considering aStart and bStart are both 0:
					// a: [1, 2, 3, 4]
					// b: [7, 1, 2, 3, 6]
					// this would place 7 before 1 and, from that time on, 1, 2, and 3
					// will be processed at zero cost
					if (sequence > (index - bStart)) {
						const node = a[aStart];
						while (bStart < index) {
							let bNode = b[bStart++];
							parentNode.insertBefore(bNode, node);

							
						}
					}
						// if the effort wasn't good enough, fallback to a replace,
						// moving both source and target indexes forward, hoping that some
					// similar node will be found later on, to go back to the fast path
					else {
						let aNode = a[aStart++];
						let bNode = b[bStart++];
						parentNode.replaceChild(
							bNode,
							aNode
						);

						
					}
				}
				// otherwise move the source forward, 'cause there's nothing to do
				else
					aStart++;
			}
				// this node has no meaning in the future list, so it's more than safe
				// to remove it, and check the next live node out instead, meaning
			// that only the live list index should be forwarded
			else {
				let aNode = a[aStart++];
				parentNode.removeChild(aNode);

				
			}
		}
	}
	return b;
};

/**
 * Path to where an expression should be evaluated within a Shell or NodeGroup.
 * Path is only valid until the expressions before it are evaluated.
 * TODO: Make this based on parent and node instead of path? */
class ExprPath {

	/**
	 * @type {ExprPathType} */
	type;

	// Used for attributes:

	/** @type {?string} Used only if type=AttribType.Value. */
	attrName;

	/**
	 * @type {?string[]} Used only if type=AttribType.Value. If null, use one expr to set the whole attribute value. */
	attrValue;

	/**
	 * @type {Set<string>} Used for type=AttribType.Multiple to remember the attributes that were added. */
	attrNames;



	/**
	 * @type {Node} Node that occurs before this ExprPath's first Node.
	 * This is necessary because udomdiff() can steal nodes from another ExprPath.
	 * If we had a pointer to our own startNode then that node could be moved somewhere else w/o us knowing it.
	 * Used only for type='content'
	 * Will be null if ExprPath has no Nodes. */
	nodeBefore;

	/**
	 * If type is AttribType.Multiple or AttribType.Value, points to the node having the attribute.
	 * If type is 'content', points to a node that never changes that this NodeGroup should always insert its nodes before.
	 *	 An empty text node will be created to insertBefore if there's no other NodeMarker and this isn't at the last position.
	 * @type {Node|HTMLElement} */
	nodeMarker;


	// These are set after an expression is assigned:

	/** @type {NodeGroup} */
	parentNg;

	/** @type {NodeGroup[]} */
	nodeGroups = [];


	// Caches to make things faster

	/**
	 * @private
	 * @type {Node[]} Cached result of getNodes() */
	nodesCache;

	/**
	 * @type {int} Index of nodeBefore among its parentNode's children. */
	nodeBeforeIndex;

	/**
	 * @type {int[]} Path to the node marker, in reverse for performance reasons. */
	nodeMarkerPath;


	/** @type {?function} A function called by renderWatched() to update the value of this expression.  */
	watchFunction

	/**
	 * @type {?function} The most recent callback passed to a .map() function in this ExprPath.
	 * TODO: What if one ExprPath has two .map() calls?  Maybe we just won't support that. */
	mapCallback

	/**
	 * @param nodeBefore {Node}
	 * @param nodeMarker {?Node}
	 * @param type {ExprPathType}
	 * @param attrName {?string}
	 * @param attrValue {string[]} */
	constructor(nodeBefore, nodeMarker, type=ExprPathType.Content, attrName=null, attrValue=null) {

		// If path is a node.
		this.nodeBefore = nodeBefore;
		this.nodeMarker = nodeMarker;
		this.type = type;
		this.attrName = attrName;
		this.attrValue = attrValue;
		if (type === ExprPathType.Multiple)
			this.attrNames = new Set();
	}

	/**
	 * Apply any type of expression.
	 * This calls other apply functions.
	 *
	 * One very messy part of this function is that it may apply multiple expressions if they're all part
	 * of the same attribute value.
	 *
	 * We should modify path.applyValueAttrib so it stores the procssed parts and then only calls
	 * setAttribute() once all the pieces are in place.
	 *
	 * @param exprs {Expr[]}*/
	apply(exprs) {
		switch (this.type) {
			case 1: // PathType.Content:
				this.applyNodes(exprs[0]);
				break;
			case 2: // PathType.Multiple:
				this.applyMultipleAttribs(this.nodeMarker, exprs[0]);
				break;
			case 5: // PathType.Comment:
				// Expressions inside Html comments.  Deliberately empty because we won't waste time updating them.
				break;
			case 6: // PathType.Event:
				this.applyEventAttrib(this.nodeMarker, exprs[0], this.parentNg.rootNg.root);
				break;
			default: // TODO: Is this sitll used?
				// One attribute value may have multiple expressions.  Here we apply them all at once.
				this.applyValueAttrib(this.nodeMarker, exprs);
				break;
		}
	}

	/**
	 * Insert/replace the nodes created by a single expression.
	 * Called by applyExprs()
	 * This function is recursive, as the functions it calls also call it.
	 * @param expr {Expr}
	 * @return {Node[]} New Nodes created. */
	applyNodes(expr) {
		let path = this;

		// This can be done at the beginning or the end of this function.
		// If at the end, we may get rendering done faster.
		// But when at the beginning, it leaves all the nodes in-use so we can do a renderWatched().
		path.freeNodeGroups();

		

		/** @type {(Node|NodeGroup|Expr)[]} */
		let newNodes = [];
		let oldNodeGroups = path.nodeGroups;
		
		let secondPass = []; // indices

		path.nodeGroups = []; // Reset before applyExact and the code below rebuilds it.
		path.applyExact(expr, newNodes, secondPass);

		this.existingTextNodes = null;

		// TODO: Create an array of old vs Nodes and NodeGroups together.
		// If they're all the same, skip the next steps.
		// Or calculate it in the loop above as we go?  Have a path.lastNodeGroups property?

		// Second pass to find close-match NodeGroups.
		let flatten = false;
		if (secondPass.length) {
			for (let [nodesIndex, ngIndex] of secondPass) {
				let ng = path.getNodeGroup(newNodes[nodesIndex], false);

				let ngNodes = ng.getNodes();

				

				if (ngNodes.length === 1) // flatten manually so we can skip flattening below.
					newNodes[nodesIndex] = ngNodes[0];

				else {
					newNodes[nodesIndex] = ngNodes;
					flatten = true;
				}
				path.nodeGroups[ngIndex] = ng;
			}

			if (flatten)
				newNodes = newNodes.flat(); // Only if second pass happens.
		}

		



		let oldNodes = path.getNodes();


		// This pre-check makes it a few percent faster?
		let same = arraySame(oldNodes, newNodes);
		if (!same) {

			path.nodesCache = newNodes; // Replaces value set by path.getNodes()

			if (this.parentNg.parentPath)
				this.parentNg.parentPath.clearNodesCache();

			// Fast clear method
			let isNowEmpty = oldNodes.length && !newNodes.length;
			if (!isNowEmpty || !path.fastClear())

				// Rearrange nodes.
				udomdiff(path.nodeMarker.parentNode, oldNodes, newNodes, path.nodeMarker);

			// TODO: Put this in a remove() function of NodeGroup.
			// Then only run it on the old nodeGroups that were actually removed.
			//Util.saveOrphans(oldNodeGroups, oldNodes);

			for (let ng of oldNodeGroups)
				if (!ng.startNode.parentNode)
					ng.saveOrphans();
		}


		
	}

	/**
	 * Used by watch() for replacing individual loop items. */
	applyLoopItemUpdate(index, template) {
		// At this point none of the nodes being used will be in nodeGroupsFree.
		let oldNg = this.nodeGroups[index];
		this.nodeGroupsAttached.add(oldNg.exactKey, oldNg);
		this.nodeGroupsAttached.add(oldNg.closeKey, oldNg);

		let ng = this.getNodeGroup(template, true);
		if (ng) {
			return; // It's an exactl match, so replace nothing.
		}



		ng = this.getNodeGroup(template, false);

		this.nodeGroups[index] = ng;

		// Splice in the new nodes.
		for (let node of ng.getNodes()) {
			oldNg.startNode.parentNode.insertBefore(node, oldNg.startNode);
		}

		if (oldNg !== ng) {
			for (let node of oldNg.getNodes())
				node.remove();
			oldNg.saveOrphans();
		}

		// TODO: update or invalidate the nodes cache?
		this.nodesCache = null;
	}


	/**
	 * Apply Nodes that are an exact match.
	 * @param expr {Template|Node|Array|function|*}
	 * @param newNodes {(Node|Template)[]}
	 * @param secondPass {Array} Locations within newNodes to evaluate later. */
	applyExact(expr, newNodes, secondPass) {

		if (expr instanceof Template) {

			let ng = this.getNodeGroup(expr, true);
			if (ng) {

				// TODO: Track ranges of changed nodes and only pass those to udomdiff?
				// But will that break the swap benchmark?
				newNodes.push(...ng.getNodes());
				this.nodeGroups.push(ng);
			}

			// If expression, mark it to be evaluated later in ExprPath.apply() to find partial match.
			else {
				secondPass.push([newNodes.length, this.nodeGroups.length]);
				newNodes.push(expr);
				this.nodeGroups.push(null); // placeholder
			}
		}

		// Node created by an expression.
		else if (expr instanceof Node) {

			// DocumentFragment created by an expression.
			if (expr instanceof DocumentFragment)
				newNodes.push(...expr.childNodes);
			else
				newNodes.push(expr);
		}

		// Arrays and functions.
		// I tried iterating over the result of a generator function to avoid this recursion and simplify the code,
		// but that consistently made the js-framework-benchmarks a few percentage points slower.
		else if (Array.isArray(expr))
			for (let subExpr of expr)
				this.applyExact(subExpr, newNodes, secondPass);

		else if (typeof expr === 'function') {
			// TODO: One ExprPath can have multiple expr functions.
			// But if using it as a watch, it should only have one at the top level.
			// So maybe this is ok.
			Globals$1.currentExprPath = this; // Used by watch3()

			this.watchFunction = expr; // TODO: Only do this if it's a top level function.
			let result = expr();
			Globals$1.currentExprPath = null;

			this.applyExact(result, newNodes, secondPass);
		}

		// Text
		else {
			// Convert falsy values (but not 0) to empty string.
			// Convert numbers to string so they compare the same.
			let text = Util.isFalsy(expr) ? '' : (expr + '');

			// Fast path for updating the text of a single text node.
			let first = this.nodeBefore.nextSibling;
			if (first.nodeType === 3 && first.nextSibling === this.nodeMarker && !newNodes.includes(first)) {
				if (first.textContent !== text)
					first.textContent = text;

				newNodes.push(first);
			}

			else {
				// TODO: Optimize this into a Set or Map or something?
				if (!this.existingTextNodes)
					this.existingTextNodes = this.getNodes().filter(n => n.nodeType === 3);

				let idx = this.existingTextNodes.findIndex(n => n.textContent === text);
				if (idx !== -1)
					newNodes.push(...this.existingTextNodes.splice(idx, 1));
				else
					newNodes.push(this.nodeMarker.ownerDocument.createTextNode(text));
			}
		}
	}

	applyMultipleAttribs(node, expr) {
		

		if (Array.isArray(expr))
			expr = expr.flat().join(' ');  // flat and join so we can accept arrays of arrays of strings.

		// Add new attributes
		let oldNames = this.attrNames;
		this.attrNames = new Set();
		if (expr) {
			let attrs = (expr +'') // Split string into multiple attributes.
				.split(/([\w-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s]+))/g)
				.map(text => text.trim())
				.filter(text => text.length);

			for (let attr of attrs) {
				let [name, value] = attr.split(/\s*=\s*/); // split on first equals.
				value = (value || '').replace(/^(['"])(.*)\1$/, '$2'); // trim value quotes if they match.
				node.setAttribute(name, value);
				this.attrNames.add(name);
			}
		}

		// Remove old attributes.
		for (let oldName of oldNames)
			if (!this.attrNames.has(oldName))
				node.removeAttribute(oldName);
	}

	/**
	 * Handle attributes for event binding, such as:
	 * onclick=${(e, el) => this.doSomething(el, 'meow')}
	 * oninput=${[this.doSomething, 'meow']}
	 * onclick=${[this, 'doSomething', 'meow']}
	 *
	 * @param node
	 * @param expr
	 * @param root */
	applyEventAttrib(node, expr, root) {
		

		let eventName = this.attrName.slice(2); // remove "on-" prefix.
		let func;

		// Convert array to function.
		let args = [];
		if (Array.isArray(expr)) {

			// oninput=${[this.doSomething, 'meow']}
			if (typeof expr[0] === 'function') {
				func = expr[0];
				args = expr.slice(1);
			}

			// oninput=${[this, 'value']}
			else {
				throw new Error('is this ever used?');
				// root.render(); // TODO: This causes infinite recursion.
			}
		}
		else
			func = expr;

		this.bindEvent(node, root, eventName, eventName, func, args);
	}


	/**
	 * Call function when eventName is triggerd on node.
	 * @param node {HTMLElement}
	 * @param root {HTMLElement}
	 * @param key {string{
	 * @param eventName {string}
	 * @param func {function}
	 * @param args {array}
	 * @param capture {boolean} */
	bindEvent(node, root, key, eventName, func, args, capture=false) {
		let nodeEvents = Globals$1.nodeEvents.get(node);
		if (!nodeEvents) {
			nodeEvents = {[key]: new Array(3)};
			Globals$1.nodeEvents.set(node, nodeEvents);
		}
		let nodeEvent = nodeEvents[key];
		if (!nodeEvent)
			nodeEvents[key] = nodeEvent = new Array(3);


		// If function has changed, remove and rebind the event.
		if (nodeEvent[0] !== func) {

			// TODO: We should be removing event listeners when calling getNodeGroup(),
			// when we get the node from the list of nodeGroupsAttached/nodeGroupsDetached,
			// instead of only when we rebind an event.
			let [existing, existingBound, _] = nodeEvent;
			if (existing)
				node.removeEventListener(eventName, existingBound, capture);

			let originalFunc = func;

			// BoundFunc sets the "this" variable to be the current Solarite component.
			let boundFunc = (event) => {
				let args = nodeEvent[2];
				return originalFunc.call(root, ...args, event, node);
			};

			// Save both the original and bound functions.
			// Original so we can compare it against a newly assigned function.
			// Bound so we can use it with removeEventListner().
			nodeEvent[0] = originalFunc;
			nodeEvent[1] = boundFunc;

			node.addEventListener(eventName, boundFunc, capture);

			// TODO: classic event attribs?
			//el[attr.name] = e => // e.g. el.onclick = ... // put "event", "el", and "this" in scope for the event code.
			//	(new Function('event', 'el', attr.value)).bind(this.manager.rootEl)(e, el)
		}

		//  Otherwise just update the args to the function.
		nodeEvents[key][2] = args;
	}

	/**
	 * Handle values, including two-way binding.
	 * @param node
	 * @param exprs */
	// TODO: node is always this.nodeMarker?
	applyValueAttrib(node, exprs) {
		let expr = exprs[0];

		// Two-way binding between attributes
		// Passing a path to the value attribute.
		// Copies the attribute to the property when the input event fires.
		// value=${[this, 'value]'}
		// checked=${[this, 'isAgree']}
		// This same logic is in NodeGroup.createNewComponent() for components.
		if (Util.isPath(expr)) {
			let [obj, path] = [expr[0], expr.slice(1)];

			if (!obj)
				throw new Error(`Solarite cannot bind to <${node.tagName.toLowerCase()} ${this.attrName}=\${[${expr.map(item => item ? `'${item}'` : item+'').join(', ')}]}>.`);

			let value = delve(obj, path);

			// Special case to allow setting select-multiple value from an array
			if (this.attrName === 'value' && node.type === 'select-multiple' && Array.isArray(value)) {
				// Set the .selected property on the options having a value within value.
				let strValues = value.map(v => v + '');
				for (let option of node.options)
					option.selected = strValues.includes(option.value);
			}
			else {
				// TODO: should we remove isFalsy, since these are always props?
				node[this.attrName] = Util.isFalsy(value) ? '' : value;
			}

			// TODO: We need to remove any old listeners, like in bindEventAttribute.
			// Does bindEvent() now handle that?
			let func = () => {
				let value = (this.attrName === 'value')
					? Util.getInputValue(node)
					: node[this.attrName];
				delve(obj, path, value);
			};

			// We use capture so we update the values before other events added by the user.
			// TODO: Bind to scroll events also?
			// What about resize events and width/height?
			this.bindEvent(node, path[0], this.attrName, 'input', func, [], true);
		}

		// Regular attribute
		else {
			// TODO: Cache this on ExprPath.isProp when Shell creates the props.  Have ExprPath.clone() copy .isProp
			// Or make it a new PathType.
			let isProp = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), this.attrName)?.set;

			// Values to toggle an attribute
			if (!this.attrValue && Util.isFalsy(expr)) {
				if (isProp)
					node[this.attrName] = false;
				node.removeAttribute(this.attrName);
			}

			else if (!this.attrValue && expr === true) {
				if (isProp)
					node[this.attrName] = true;
				node.setAttribute(this.attrName, '');
			}

			// A non-toggled attribute
			else {

				let joinedValue;
				if (this.attrValue) {
					let value = [];
					for (let i = 0; i < this.attrValue.length; i++) {
						value.push(this.attrValue[i]);
						if (i < this.attrValue.length - 1) {
							let val = exprs[i];
							if (!Util.isFalsy(val) && Util.isPrimitive(val))
								value.push(val);
						}
					}
					joinedValue = value.join('');
				} else
					joinedValue = Util.isPrimitive(expr) ? expr : '';

				// Only update attributes if the value has changed.
				// This is needed for setting input.value, .checked, option.selected, etc.

				let oldVal = isProp ? node[this.attrName] : node.getAttribute(this.attrName);
				if (oldVal !== joinedValue) {

					// <textarea value=${expr}></textarea>
					// Without this branch we have no way to set the value of a textarea,
					// since we also prohibit expressions that are a child of textarea.
					if (isProp)
						node[this.attrName] = joinedValue;
					// TODO: Putting an 'else' here would be more performant
					node.setAttribute(this.attrName, joinedValue);
				}
			}
		}
	}


	/**
	 *
	 * @param newRoot {HTMLElement}
	 * @param pathOffset {int}
	 * @return {ExprPath} */
	clone(newRoot, pathOffset=0) {
		

		// Resolve node paths.
		let nodeMarker, nodeBefore;
		let root = newRoot;
		let path = pathOffset ? this.nodeMarkerPath.slice(0, -pathOffset) : this.nodeMarkerPath;
		for (let i=path.length-1; i>0; i--) // Resolve the path.
			root = root.childNodes[path[i]];
		let childNodes = root.childNodes;

		nodeMarker = path.length ? childNodes[path[0]] : newRoot;
		if (this.nodeBefore)
			nodeBefore = childNodes[this.nodeBeforeIndex];

		let result = new ExprPath(nodeBefore, nodeMarker, this.type, this.attrName, this.attrValue);

		

		return result;
	}

	/**
	 * Clear the nodeCache of this ExprPath, as well as all parent and child ExprPaths that
	 * share the same DOM parent node.
	 *
	 * TODO: Is recursive clearing ever necessary? */
	clearNodesCache() {
		let path = this;

		// Clear cache parent ExprPaths that have the same parentNode
		let parentNode = this.nodeMarker.parentNode;
		while (path && path.nodeMarker.parentNode === parentNode) {
			path.nodesCache = null;
			path = path.parentNg?.parentPath;

			// If stuck in an infinite loop here, the problem is likely due to Template hash colisions.
			// Which cause one path to be the descendant of itself, creating a cycle.
		}

		// Commented out on Sep 30, 2024 b/c it was making the benchmark never finish when adding 10k rows.
		//clearChildNodeCache(this);
	}


	/**
	 * Attempt to remove all of this ExprPath's nodes from the DOM, if it can be done using a special fast method.
	 * @returns {boolean} Returns false if Nodes weren't removed, and they should instead be removed manually. */
	fastClear() {
		let parent = this.nodeBefore.parentNode;
		if (this.nodeBefore === parent.firstChild && this.nodeMarker === parent.lastChild) {

			// If parent is the only child of the grandparent, replace the whole parent.
			// And if it has no siblings, it's not created by a NodeGroup/path.
			// Commented out because this will break any references.
			// And because I don't see much performance difference.
			// let grandparent = parent.parentNode
			// if (grandparent && parent === grandparent.firstChild && parent === grandparent.lastChild && !parent.hasAttribute('id')) {
			// 	let replacement = document.createElement(parent.tagName)
			// 	replacement.append(this.nodeBefore, this.nodeMarker)
			// 	for (let attrib of parent.attributes)
			// 		replacement.setAttribute(attrib.name, attrib.value)
			// 	parent.replaceWith(replacement)
			// }
			// else {
				parent.innerHTML = ''; // Faster than calling .removeChild() a thousand times.
				parent.append(this.nodeBefore, this.nodeMarker);
			//}
			return true;
		}
		return false;
	}

	/**
	 * @return {(Node|HTMLElement)[]} */
	getNodes() {

		// Why doesn't this work?
		// let result2 = [];
		// for (let ng of this.nodeGroups)
		// 	result2.push(...ng.getNodes())
		// return result2;


		let result;

		// This shaves about 5ms off the partialUpdate benchmark.
		result = this.nodesCache;
		if (result) {

			

			return result
		}

		result = [];
		let current = this.nodeBefore.nextSibling;
		let nodeMarker = this.nodeMarker;
		while (current && current !== nodeMarker) {
			result.push(current);
			current = current.nextSibling;
		}

		this.nodesCache = result;
		return result;
	}

	getParentNode() { // Same as this.parentNode
		return this.nodeMarker.parentNode
	}

	/**
	 * Get an unused NodeGroup that matches the template's html and expressions (exact=true)
	 * or at least the html (exact=false).
	 * Remove it from nodeGroupsFree if it exists, or create it if not.
	 * Then add it to nodeGroupsInUse.
	 *
	 * @param template {Template}
	 * @param exact {boolean}
	 *     If true, return an exact match, or null.
	 *     If false, either find a match for the template's html and then apply the template's expressions,
	 *         or createa  new NodeGroup from the template.
	 * @return {NodeGroup} */
	getNodeGroup(template, exact=true) {
		// This makes the benchmark 10x slower!
		//if (exact && this.nodeGroupsFree.isEmpty())
		//	return null;

		let result;
		let collection = this.nodeGroupsAttached;

		// TODO: Would it be faster to maintain a separate list of detached nodegroups?
		if (exact) { // [below] parentElement will be null if the parent is a DocumentFragment
			result = this.nodeGroupsAttached.deleteAny(template.getExactKey());
			if (!result) {
				result = this.nodeGroupsDetached.deleteAny(template.getExactKey());
				collection = this.nodeGroupsDetached;
			}

			if (result) // also delete the matching close key.
				collection.deleteSpecific(template.getCloseKey(), result);
			else {
				return null;
			}
		}

		// Find a close match.
		// This is a match that has matching html, but different expressions applied.
		// We can then apply the expressions to make it an exact match.
		else {
			result = this.nodeGroupsAttached.deleteAny(template.getCloseKey());
			if (!result) {
				result = this.nodeGroupsDetached.deleteAny(template.getCloseKey());
				collection = this.nodeGroupsDetached;
			}

			if (result) {
				
				collection.deleteSpecific(result.exactKey, result);

				// Update this close match with the new expression values.
				result.applyExprs(template.exprs);
				result.exactKey = template.getExactKey(); // TODO: Should this be set elsewhere?
			}
		}

		if (!result)
			result = new NodeGroup(template, this);

		// old:
		this.nodeGroupsRendered.push(result);

		
		return result;
	}

	isComponent() {
		// Events won't have type===Component.
		// TODO: Have a special flag for components instead of it being on the type?
		return this.type === ExprPathType.Component || (this.attrName && this.nodeMarker.tagName && this.nodeMarker.tagName.includes('-'));
	}

	/**
	 * Nodes that have been used during the current render().
	 * Used with getNodeGroup() and freeNodeGroups().
	 * TODO: Use an array of WeakRef so the gc can collect them?
	 * TODO: Put items back in nodeGroupsInUse after applyExpr() is called, not before.
	 * @type {NodeGroup[]} */
	nodeGroupsRendered = [];

	/**
	 * Nodes that were used during the last render()
	 * Used with getNodeGroup() and freeNodeGroups().
	 * Each NodeGroup is here twice, once under an exact key, and once under the close key.
	 * @type {MultiValueMap<key:string, value:NodeGroup>} */
	nodeGroupsAttached = new MultiValueMap();

	/**
	 * Nodes that were not used during the last render().
	 * @type {MultiValueMap} */
	nodeGroupsDetached = new MultiValueMap();


	/**
	 * Move everything from this.nodeGroupsRendered to this.nodeGroupsAttached and nodeGroupsDetached.
	 * TODO: this could run as needed in getNodeGroup? */
	freeNodeGroups() {
		// old:

		// Add nodes that weren't used during render() to nodeGroupsDetached
		let previouslyAttached = this.nodeGroupsAttached.data;
		let detached = this.nodeGroupsDetached.data;
		for (let key in previouslyAttached) {
			let set = detached[key];
			if (!set)
				detached[key] = previouslyAttached[key];
			else
				for (let ng of previouslyAttached[key])
					set.add(ng);
		}

		// Add nodes that were used during render() to nodeGroupsRendered.
		this.nodeGroupsAttached = new MultiValueMap();
		let ngr = this.nodeGroupsAttached;
		for (let ng of this.nodeGroupsRendered) {
			ngr.add(ng.exactKey, ng);
			ngr.add(ng.closeKey, ng);
		}

		this.nodeGroupsRendered = [];
	}

	
}

/** @enum {int} */
const ExprPathType = {
	/** Child of a node */
	Content: 1,
	
	/** One or more whole attributes */
	Multiple: 2,
	
	/** Value of an attribute. */
	Value: 3,
	
	/** Value of an attribute being passed to a component. */
	Component: 4,
	
	/** Expressions inside Html comments. */
	Comment: 5,

	/** Value of an attribute. */
	Event: 6,
};


/** @return {int[]} Returns indices in reverse order, because doing it that way is faster. */
function getNodePath(node) {
	let result = [];
	while(true) {
		let parent = node.parentNode;
		if (!parent)
			break;
		result.push(Array.prototype.indexOf.call(node.parentNode.childNodes, node));
		node = parent;
	}
	return result;
}

/**
 * Note that the path is backward, with the outermost element at the end.
 * @param root {HTMLElement|Document|DocumentFragment|ParentNode}
 * @param path {int[]}
 * @returns {Node|HTMLElement} */
function resolveNodePath(root, path) {
	for (let i=path.length-1; i>=0; i--)
		root = root.childNodes[path[i]];
	return root;
}

class HtmlParser {
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

/**
 * A Shell is created from a tagged template expression instantiated as Nodes,
 * but without any expressions filled in.
 * Only one Shell is created for all the items in a loop.
 *
 * When a NodeGroup is created from a Template's html strings,
 * the NodeGroup then clones the Shell's fragment to be its nodes. */
class Shell {

	/**
	 * @type {DocumentFragment} DOM parent of the shell nodes. */
	fragment;

	/** @type {ExprPath[]} Paths to where expressions should go. */
	paths = [];

	// Elements with events.  Not yet used.
	// events = [];

	/** @type {int[][]} Array of paths */
	ids = [];

	/** @type {int[][]} Array of paths */
	scripts = [];

	/** @type {int[][]} Array of paths */
	styles = [];

	/** @type {int[][]} Array of paths.  Used by activateEmbeds() to quickly find components. */
	staticComponents = [];

	/** @type {{path:int[], attribs:Object<string, string>}[]} */
	//componentAttribs = [];



	/**
	 * Create the nodes but without filling in the expressions.
	 * This is useful because the expression-less nodes created by a template can be cached.
	 * @param html {string[]} Html strings, split on places where an expression exists.  */
	constructor(html=null) {
		if (!html)
			return;

		

		// 1.  Add placeholders
		let joinedHtml = Shell.addPlaceholders(html);

		let template = document.createElement('template'); // Using a single global template won't keep the nodes as children of the DocumentFragment.
		if (joinedHtml)
			template.innerHTML = joinedHtml;
      else // Create one text node, so shell isn't empty and NodeGroups created from it have something to point the startNode and endNode at.
         template.content.append(document.createTextNode(''));
		this.fragment = template.content;

		// 3. Find placeholders
		let node;
		let toRemove = [];
		const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT);
		while (node = walker.nextNode()) {

			// Remove previous after each iteration, so paths will still be calculated correctly.
			toRemove.map(el => el.remove());
			toRemove = [];
			
			// Replace attributes
			if (node.nodeType === 1) {
				for (let attr of [...node.attributes]) { // Copy the attributes array b/c we remove attributes as we go.

					// Whole attribute
					let matches = attr.name.match(/^[\ue000-\uf8ff]$/);
					if (matches) {
						this.paths.push(new ExprPath(null, node, ExprPathType.Multiple));
						node.removeAttribute(matches[0]);
					}

					// Just the attribute value.
					else {
						let parts = attr.value.split(/[\ue000-\uf8ff]/g);
						if (parts.length > 1) {
							let nonEmptyParts = (parts.length === 2 && !parts[0].length && !parts[1].length) ? null : parts;
							let type = isEvent(attr.name) ? ExprPathType.Event : ExprPathType.Value;

							this.paths.push(new ExprPath(null, node, type, attr.name, nonEmptyParts));
							node.setAttribute(attr.name, parts.join(''));
						}
					}
				}
			}
			// Replace comment placeholders
			else if (node.nodeType === 8 && node.nodeValue === '!✨!') {

				// Get or create nodeBefore.
				let nodeBefore = node.previousSibling; // Can be the same as another Path's nodeMarker.
				if (!nodeBefore) {
					nodeBefore = document.createComment('ExprPath:'+this.paths.length);
					node.parentNode.insertBefore(nodeBefore, node);
				}
				

				// Get the next node.
				let nodeMarker;

				// A subsequent node is available to be a nodeMarker.
				if (node.nextSibling && (node.nextSibling.nodeType !== 8 || node.nextSibling.textContent !== '!✨!')) {
					nodeMarker = node.nextSibling;
					toRemove.push(node); // Removing them here will mess up the treeWalker.
				}
				// Re-use existing comment placeholder.
				else {
					nodeMarker = node;
					nodeMarker.textContent = 'ExprPathEnd:'+ this.paths.length;
				}
				

				let path = new ExprPath(nodeBefore, nodeMarker, ExprPathType.Content);
				this.paths.push(path);
			}

			else if (node.nodeType === 3 && node.parentNode?.tagName === 'TEXTAREA' && node.textContent.includes('<!--!✨!-->'))
				throw new Error(`Textarea can't have expressions inside them. Use <textarea value="\${...}"> instead.`);

			
			
			// Sometimes users will comment out a block of html code that has expressions.
			// Here we look for expressions in comments.
			// We don't actually update them dynamically, but we still add paths for them.
			// That way the expression count still matches.
			else if (node.nodeType === Node.COMMENT_NODE) {
				let parts = node.textContent.split(/[\ue000-\uf8ff]/g);
				for (let i=0; i<parts.length-1; i++) {
					let path = new ExprPath(node.previousSibling, node);
					path.type = ExprPathType.Comment;
					this.paths.push(path);
				}
			}

			// Replace comment placeholders inside script and style tags, which have become text nodes.
			else if (node.nodeType === Node.TEXT_NODE && ['SCRIPT', 'STYLE'].includes(node.parentNode?.nodeName)) {
				let parts = node.textContent.split(commentPlaceholder);
				if (parts.length > 1) {

					let placeholders = [];
					for (let i = 0; i<parts.length; i++) {
						let current = document.createTextNode(parts[i]);
						node.parentNode.insertBefore(current, node);
						if (i > 0)
							placeholders.push(current);
					}

					for (let i=0, node; node=placeholders[i]; i++) {
						let path = new ExprPath(node.previousSibling, node, ExprPathType.Content);
						this.paths.push(path);

						
					}

					// Removing them here will mess up the treeWalker.
					toRemove.push(node);
				}
			}
		}
		toRemove.map(el => el.remove());

		// Handle solarite-placeholder's.

		// Rename "is" attributes so the Web Components don't instantiate until we have the values of their PathExpr arguments.
		// that happens in NodeGroup.applyComponentExprs()
		for (let el of this.fragment.querySelectorAll('[is]')) {
			el.setAttribute('_is', el.getAttribute('is'));
		}

		for (let path of this.paths) {
			if (path.nodeBefore)
				path.nodeBeforeIndex = Array.prototype.indexOf.call(path.nodeBefore.parentNode.childNodes, path.nodeBefore);
			path.nodeMarkerPath = getNodePath(path.nodeMarker);

			// Cache so we don't have to calculate this later inside NodeGroup.applyExprs()
			if (path.type === ExprPathType.Value && path.nodeMarker.nodeType === 1 &&
				(path.nodeMarker.tagName.includes('-') || path.nodeMarker.hasAttribute('is'))) {
				path.type = ExprPathType.Component;
			}
		}

		this.findEmbeds();

		
	}

	/**
	 * 1. Add a Unicode placeholder char for where expressions go within attributes.
	 * 2. Add a comment placeholder for where expressions are children of other nodes.
	 * 3. Append -solarite-placeholder to the tag names of custom components so that we can wait to instantiate them later.
	 * @param htmlChunks {string[]}
	 * @returns {string} */
	static addPlaceholders(htmlChunks) {
		let tokens = [];

		function addToken(token, context) {

			if (context === HtmlParser.Tag) {


				// Find Solarite Components tags and append -solarite-placeholder to their tag names.
				// This way we can gather their constructor arguments and their children before we call their constructor.
				// Later, NodeGroup.createNewComponent() will replace them with the real components.
				// Ctrl+F "solarite-placeholder" in project to find all code that manages subcomponents.
				token = token.replace(/^<\/?[a-z][a-z0-9]*-[a-z0-9-]+/i, match => match + '-solarite-placeholder');

				// This was a path where I was going to grab the original case of the attribute names, to allow
				// using them when passing arguments to the constructor.
				// But I decided to convert dash-case to camelCase instead.
				// token.replace(/(?<=\s)[a-z0-9-]+/gi, match => {
				// 	console.log(match, '`' + token + '`')
				// 	let path = getNodePath(el);
				// 	this.componentAttribs.push({path, attribs: attributes});
				// });
			}
			tokens.push(token);
		}

		let htmlParser = new HtmlParser(); // Reset the context.
		for (let i = 0; i < htmlChunks.length; i++) {
			let lastHtml = htmlChunks[i];

			// Append -solarite-placholder to web component tags, so we can pass args to them when they're instantiated.
			let lastIndex = 0;
			let context = htmlParser.parse(lastHtml, (html, index, oldContext, newContext) => {
				if (lastIndex !== index) {
					let token = html.slice(lastIndex, index);
					addToken(token, oldContext);
				}
				lastIndex = index;
			});

			// Insert placeholders
			if (i < htmlChunks.length - 1) {
				if (context === HtmlParser.Text)
					tokens.push(commentPlaceholder); // Comment Placeholder. because we can't put text in between <tr> tags for example.
				else
					tokens.push(String.fromCharCode(attribPlaceholder + i));
			}
		}

		return tokens.join('');
	}

	/**
	 * We find the path to every embed here once in the Shell, instead of every time a NodeGroup is instantiated.
	 * When a Nodegroup is created, it calls NodeGroup.activateEmbeds() that uses these paths.
	 * Populates:
	 * this.scripts
	 * this.styles
	 * this.ids
	 * this.staticComponents */
	findEmbeds() {
		this.scripts = Array.prototype.map.call(this.fragment.querySelectorAll('scripts'), el => getNodePath(el));

		// TODO: only find styles that have ExprPaths in them?
		this.styles = Array.prototype.map.call(this.fragment.querySelectorAll('style'), el => getNodePath(el));

		let idEls = this.fragment.querySelectorAll('[id],[data-id]');
		

		// Check for valid id names.
		for (let el of idEls) {
			let id = el.getAttribute('data-id') || el.getAttribute('id');
			if (Globals$1.div.hasOwnProperty(id))
				throw new Error(`<${el.tagName.toLowerCase()} id="${id}"> can't override existing HTMLElement id property.`)
		}


		this.ids = Array.prototype.map.call(idEls, el => getNodePath(el));

		for (let el of this.fragment.querySelectorAll('*')) {
			// Events (not yet used)
			// for (let attrib of el.attributes)
			// 	if (isEvent(attrib.name))
			// 		this.events.push([attrib.name, getNodePath(el)])

			if (el.tagName.includes('-') || el.hasAttribute('_is'))

				// Dynamic components are components that have attributes with expression values.
				// They are created from applyExprs()
				// But static components are created in a separate path inside the NodeGroup constructor.
				if (!this.paths.find(path => path.nodeMarker === el))
					this.staticComponents.push(getNodePath(el));
		}

	}

	/**
	 * Get the shell for the html strings.
	 * @param htmlStrings {string[]} Typically comes from a Template.
	 * @returns {Shell} */
	static get(htmlStrings) {
		let result = Globals$1.shells.get(htmlStrings);
		if (!result) {
			result = new Shell(htmlStrings);
			Globals$1.shells.set(htmlStrings, result); // cache
		}

		
		return result;
	}

	
}


const commentPlaceholder = `<!--!✨!-->`;


// We increment the placeholder char as we go because nodes can't have the same attribute more than once.
const attribPlaceholder = 0xe000; // https://en.wikipedia.org/wiki/Private_Use_Areas  6400.

/** @typedef {boolean|string|number|function|Object|Array|Date|Node|Template} Expr */

/**
 * A group of Nodes instantiated from a Shell, with Expr's filled in.
 *
 * The range is determined by startNode and nodeMarker.
 * startNode - never null.  An empty text node is created before the first path if none exists.
 * nodeMarker - null if this Nodegroup is at the end of its parents' nodes.
 *
 *
 * */
class NodeGroup {

	/**
	 * @Type {RootNodeGroup} */
	rootNg;

	/** @type {ExprPath} */
	parentPath;

	/** @type {Node|HTMLElement} First node of NodeGroup. Should never be null. */
	startNode;

	/** @type {Node|HTMLElement} A node that never changes that this NodeGroup should always insert its nodes before.
	 * An empty text node will be created to insertBefore if there's no other NodeMarker and this isn't at the last position.*/
	endNode;

	/** @type {ExprPath[]} */
	paths = [];

	/** @type {string} Key that matches the template and the expressions. */
	exactKey;

	/** @type {string} Key that only matches the template. */
	closeKey;

	/**
	 * @internal
	 * @type {Node[]} Cached result of getNodes() used only for improving performance.*/
	nodesCache;

	/**
	 * A map between <style> Elements and their text content.
	 * This lets NodeGroup.updateStyles() see when the style text has changed.
	 * @type {?Map<HTMLStyleElement, string>} */
	styles;

	currentComponentProps = {};
	

	/**
	 * Create an "instantiated" NodeGroup from a Template and add it to an element.
	 * @param template {Template}  Create it from the html strings and expressions in this template.
	 * @param parentPath {?ExprPath} */
	constructor(template, parentPath=null) {
		if (!(this instanceof RootNodeGroup)) {
			let [fragment, shell] = this.init(template, parentPath);

			this.updatePaths(fragment, shell.paths);

			this.activateEmbeds(fragment, shell);

			// Apply exprs
			this.applyExprs(template.exprs);
		}
	}

	/**
	 * Common init shared by RootNodeGroup and NodeGroup constructors.
	 * But in a separate function because they need to do this at a different step.
	 * @param template {Template}  Create it from the html strings and expressions in this template.
	 * @param parentPath {?ExprPath}
	 * @param exactKey {?string} Optional, if already calculated.
	 * @param closeKey {?string}
	 * @returns {[DocumentFragment, Shell]} */
	init(template, parentPath=null, exactKey=null, closeKey=null) {
		this.exactKey = exactKey || template.getExactKey();
		this.closeKey = closeKey || template.getCloseKey();

		this.parentPath = parentPath;
		this.rootNg = parentPath?.parentNg?.rootNg || this;

		

		/** @type {Template} */
		this.template = template;

		// new!  Is this needed?
		template.nodeGroup = this;

		// Get a cached version of the parsed and instantiated html, and ExprPaths.
		let shell = Shell.get(template.html);
		let fragment = shell.fragment.cloneNode(true);

		let childNodes = fragment.childNodes;
		this.startNode = childNodes[0];
		this.endNode = childNodes[childNodes.length - 1];

		return [fragment, shell];
	}

	/**
	 * Use the paths to insert the given expressions.
	 * Dispatches expression handling to other functions depending on the path type.
	 * @param exprs {(*|*[]|function|Template)[]}
	 * @param paths {?ExprPath[]} Optional.  Only used for testing.  Normally uses this.paths.  */
	applyExprs(exprs, paths=null) {
		paths = paths || this.paths;

		

		// Things to consider:
		// 1. One path may use multipe expressions.  E.g. <div class="${1} ${2}">
		// 2. One component may need to use multiple attribute paths to be instantiated.
		// 3. We apply them in reverse order so that a <select> box has its children created from an expression
		//    before its instantiated and its value attribute is set via an expression.

		let exprIndex = exprs.length - 1; // Update exprs at paths.
		let lastComponentPathIndex;
		let pathExprs = new Array(paths.length); // Store all the expressions that map to a single path.  Only paths to attribute values can have more than one.
		for (let i = paths.length - 1, path; path = paths[i]; i--) {
			let prevPath = paths[i - 1];
			let nextPath = paths[i + 1];

			// Get the expressions associated with this path.
			if (path.attrValue?.length > 2) {
				let startIndex = (exprIndex - (path.attrValue.length - 1)) + 1;
				pathExprs[i] = exprs.slice(startIndex, exprIndex + 1); // probably doesn't allocate if the JS vm implements copy on write.
				exprIndex -= pathExprs[i].length;
			} else {
				pathExprs[i] = [exprs[exprIndex]];
				exprIndex--;
			}

			// TODO: Need to end and restart this block when going from one component to the next?
			// Think of having two adjacent components.
			// But the dynamicAttribsAdjacet test already passes.

			// If a component:
			// 1. Instantiate it if it hasn't already been, sending all expr's to its constructor.
			// 2. Otherwise send them to its render function.
			// Components with no expressions as attributes are instead activated in activateEmbeds().
			if (path.nodeMarker !== this.rootNg.root && path.isComponent()) {

				if (!nextPath || !nextPath.isComponent() || nextPath.nodeMarker !== path.nodeMarker)
					lastComponentPathIndex = i;
				let isFirstComponentPath = !prevPath || !prevPath.isComponent() || prevPath.nodeMarker !== path.nodeMarker;

				if (isFirstComponentPath) {

					let componentProps = {};
					for (let j=i; j<=lastComponentPathIndex; j++) {
						let attrName = paths[j].attrName; // Util.dashesToCamel(paths[j].attrName);
						componentProps[attrName] = pathExprs[j].length > 1 ? pathExprs[j].join('') : pathExprs[j][0];
					}

					this.applyComponentExprs(path.nodeMarker, componentProps);

					// Set attributes on component.
					for (let j=i; j<=lastComponentPathIndex; j++)
						paths[j].apply(pathExprs[j]);
				}
			}

			// Else apply it normally
			else
				path.apply(pathExprs[i]);


		} // end for(path of this.paths)


		// TODO: Only do this if we have ExprPaths within styles?
		this.updateStyles();

		// Invalidate the nodes cache because we just changed it.
		this.nodesCache = null;

		// If there's leftover expressions, there's probably an issue with the Shell that created this NodeGroup,
		// and the number of paths not matching.
		


		
	}

	/**
	 * Create a nested Component or call render with the new props.
	 * @param el {Solarite:HTMLElement}
	 * @param props {Object} */
	applyComponentExprs(el, props) {

		// TODO: Does a hash of this already exist somewhere?
		// Perhaps if Components were treated as child NodeGroups, which would need to be the child of an ExprPath,
		// then we could re-use the hash and logic from NodeManager?
		let newHash = getObjectHash(props);

		let isPreHtmlElement = el.tagName.endsWith('-SOLARITE-PLACEHOLDER');
		let isPreIsElement = el.hasAttribute('_is');


		// Instantiate a placeholder.
		if (isPreHtmlElement || isPreIsElement)
			el = this.createNewComponent(el, isPreHtmlElement, props);

		// Call render() with the same params that would've been passed to the constructor.
		else if (el.render) {
			let oldHash = Globals$1.componentArgsHash.get(el);
			if (oldHash !== newHash) {
				let args = {};
				for (let name in props || {})
					args[Util.dashesToCamel(name)] = props[name];
				el.render(args); // Pass new values of props to render so it can decide how it wants to respond.
			}
		}

		Globals$1.componentArgsHash.set(el, newHash);
	}
	
	/**
	 * We swap the placeholder element for the real element so we can pass its dynamic attributes
	 * to its constructor.
	 *
	 * The logic of this function is complex and could use cleaning up.
	 *
	 * @param el
	 * @param isPreHtmlElement
	 * @param props {Object} Attributes with dynamic values.
	 * @return {HTMLElement} */
	createNewComponent(el, isPreHtmlElement=undefined, props=undefined) {
		if (isPreHtmlElement === undefined)
			isPreHtmlElement = !el.hasAttribute('_is');
		
		let tagName = (isPreHtmlElement
			? el.tagName.slice(0, -21) // Remove -SOLARITE-PLACEHOLDER
			: el.getAttribute('is')).toLowerCase();


		// Throw if custom element isn't defined.
		let Constructor = customElements.get(tagName);
		if (!Constructor)
			throw new Error(`The custom tag name ${tagName} is not registered.`)

		let args = {};
		for (let name in props || {})
			args[Util.dashesToCamel(name)] = props[name];
		
		// Pass other attribs to constructor, since otherwise they're not yet set on the element,
		// and the constructor would otherwise have no way to see them.
		if (el.attributes.length) {
			for (let attrib of el.attributes) {
				let attribName = Util.dashesToCamel(attrib.name);
				if (!args.hasOwnProperty(attribName))
					args[attribName] = attrib.value;
			}
		}

		// We pass the childNodes to the constructor so it can know about them,
		// instead of only afterward when they're appended to the slot below.
		// This is useful for a custom selectbox, for example.
		// Globals.pendingChildren stores the childen so the super construtor call to Solarite's constructor
		// can add them as children before the rest of the constructor code executes.
		let ch = [...el.childNodes];
		//if (el instanceof Solarite)
		//	Globals.pendingChildren.push(ch);  // pop() is called in Solarite constructor.
		let newEl = new Constructor(args, ch);

		if (!isPreHtmlElement)
			newEl.setAttribute('is', el.getAttribute('is').toLowerCase());

		// Replace the placeholder tag with the instantiated web component.
		el.replaceWith(newEl);

		// Set children / slot children
		// TODO: Match named slots.
		// TODO: This only appends to slot if render() is called in the constructor.
		//let slot = newEl.querySelector('slot') || newEl;
		//slot.append(...el.childNodes);

		// If an id pointed at the placeholder, update it to point to the new element.
		let id = el.getAttribute('data-id') || el.getAttribute('id');
		if (id)
			delve(this.getRootNode(), id.split(/\./g), newEl);
		
		
		// Update paths to use replaced element.
		for (let path of this.paths) {
			if (path.nodeMarker === el)
				path.nodeMarker = newEl;
			if (path.nodeBefore === el)
				path.nodeBefore = newEl;
		}
		if (this.startNode === el)
			this.startNode = newEl;
		if (this.endNode === el)
			this.endNode = newEl;
		
		
		// applyComponentExprs() is called because we're rendering.
		// So we want to render the sub-component also.
		if (newEl.renderFirstTime)
			newEl.renderFirstTime();

		// Copy attributes over.
		for (let attrib of el.attributes)
			if (attrib.name !== '_is')
				newEl.setAttribute(attrib.name, attrib.value);

		// Set dynamic attributes if they are primitive types.
		for (let name in props) {
			let val = props[name];
			if (typeof val === 'boolean') {
				if (val !== false && val !== undefined && val !== null)
					newEl.setAttribute(name, '');
			}

			// If type is a non-boolean primitive, set the attribute value.
			else if (['number', 'bigint', 'string'].includes(typeof val))
				newEl.setAttribute(name, val);
		}
		
		return newEl;
	}

	/**
	 * Get all the nodes inclusive between startNode and endNode.
	 * TODO: when not using nodesCache, could this use less memory with yield?
	 * But we'd need to save the reference to the next Node in case it's removed.
	 * @return {(Node|HTMLElement)[]} */
	getNodes() {
		// applyExprs() invalidates this cache.
		let result = this.nodesCache;
		if (result) // This does speed up the partialUpdate benchmark by 10-15%.
			return result;

		result = [];
		let current = this.startNode;
		let afterLast = this.endNode?.nextSibling;
		while (current && current !== afterLast) {
			result.push(current);
			current = current.nextSibling;
		}

		this.nodesCache = result;
		return result;
	}

	getParentNode() {
		return this.startNode?.parentNode
	}

	/**
	 * Get the root element of the NodeGroup's RootNodeGroup.
	 * @returns {HTMLElement|DocumentFragment} */
	getRootNode() {
		return this.rootNg.root;
	}

	/**
	 * @returns {RootNodeGroup} */
	getRootNodeGroup() {
		return this.rootNg;
	}

	/**
	 * Requires the nodeCache to be present. */
	saveOrphans() {
		
		
		let fragment = document.createDocumentFragment();
		for (let node of this.getNodes())
			fragment.append(node);
	}


	updatePaths(fragment, paths, offset) {
		// Update paths to point to the fragment.
		this.paths.length = paths.length;
		for (let i=0; i<paths.length; i++) {
			let path = paths[i].clone(fragment, offset);
			path.parentNg = this;
			this.paths[i] = path;
		}
	}

	updateStyles() {
		if (this.styles)
			for (let [style, oldText] of this.styles) {
				let newText = style.textContent;
				if (oldText !== newText)
					Util.bindStyles(style, this.getRootNodeGroup().root);
			}
	}

	


	/**
	 * @param root {HTMLElement}
	 * @param shell {Shell}
	 * @param pathOffset {int} */
	activateEmbeds(root, shell, pathOffset=0) {

		// static components.  These are WebComponents that do not have any constructor arguments that are expressions.
		// Those are instead created by applyExpr() which calls applyComponentExprs() which calls createNewcomponent().
		// Maybe someday these two paths will be merged?
		// Must happen before ids because createNewComponent will replace the element.
		for (let path of shell.staticComponents) {
			if (pathOffset)
				path = path.slice(0, -pathOffset);
			let el = resolveNodePath(root, path);

			// Shell doesn't know if a web component is the pseudoRoot so we have to detect it here.
			// Recreating it is necessary so we can pass the constructor args to it.
			if (root !== el/* && !isReplaceEl(root, el)*/) // TODO: is isReplaceEl necessary?
				this.createNewComponent(el);
		}

		let rootEl = this.rootNg.root;
		if (rootEl) {

			// ids
			if (this.options?.ids !== false)
				for (let path of shell.ids) {
					if (pathOffset)
						path = path.slice(0, -pathOffset);
					let el = resolveNodePath(root, path);
					let id = el.getAttribute('data-id') || el.getAttribute('id');
					if (id) { // If something hasn't removed the id.

						// Don't allow overwriting existing class properties if they already have a non-Node value.
						if (rootEl[id] && !(rootEl[id] instanceof Node))
							throw new Error(`${rootEl.constructor.name}.${id} already has a value.  ` +
								`Can't set it as a reference to <${el.tagName.toLowerCase()} id="${id}">`);

						delve(rootEl, id.split(/\./g), el);
					}
				}

			// styles
			if (this.options?.styles !== false) {
				if (shell.styles.length)
					this.styles = new Map();
				for (let path of shell.styles) {
					if (pathOffset)
						path = path.slice(0, -pathOffset);
					let style = resolveNodePath(root, path);
					if (rootEl.nodeType === 1) {
						Util.bindStyles(style, rootEl);
						this.styles.set(style, style.textContent);
					}
				}

			}
			// scripts
			if (this.options?.scripts !== false) {
				for (let path of shell.scripts) {
					if (pathOffset)
						path = path.slice(0, -pathOffset);
					let script = resolveNodePath(root, path);
					eval(script.textContent);
				}
			}
		}
	}
}


class RootNodeGroup extends NodeGroup {

	/**
	 * Root node at the top of the hierarchy.
	 * @type {HTMLElement} */
	root;

	/**
	 * Store the expressions that use this watched variable,
	 * along with the functions used to get their values.
	 * @type {Object<field:string, Set<ExprPath>>} */
	watchedExprPaths = {};

	/**
	 *
	 * @type {Map<ExprPath, NewValue|Array>} */
	exprsToRender = new Map();

	/**
	 *
	 * @param template
	 * @param el
	 * @param options {?object}
	 */
	constructor(template, el, options) {
		super(template);

		this.options = options;

		this.rootNg = this;
		let [fragment, shell] = this.init(template);

		// If adding NodeGroup to an element.
		let offset = 0;
		let root = fragment; // TODO: Rename so it's not confused with this.root.
		if (el) {
			Globals$1.nodeGroups.set(el, this);

			// Save slot children
			let slotFragment;
			if (el.childNodes.length) {
				slotFragment = document.createDocumentFragment();
				slotFragment.append(...el.childNodes);
			}

			this.root = el;

			// If el should replace the root node of the fragment.
			if (isReplaceEl(fragment, el)) {
				el.append(...fragment.children[0].childNodes);

				// Copy attributes
				for (let attrib of fragment.children[0].attributes)
					if (!el.hasAttribute(attrib.name))
						el.setAttribute(attrib.name, attrib.value);

				// Go one level deeper into all of shell's paths.
				offset = 1;
			}
			else {
				let isEmpty = fragment.childNodes.length === 1 && fragment.childNodes[0].nodeType === 3 && fragment.childNodes[0].textContent === '';
				if (!isEmpty)
					el.append(...fragment.childNodes);
			}

			// Setup slots
			if (slotFragment) {
				for (let slot of el.querySelectorAll('slot[name]')) {
					let name = slot.getAttribute('name');
					if (name) {
						let slotChildren = slotFragment.querySelectorAll(`[slot='${name}']`);
						slot.append(...slotChildren);
					}
				}
				let unamedSlot = el.querySelector('slot:not([name])');
				if (unamedSlot)
					unamedSlot.append(slotFragment);
				else
					el.append(slotFragment);
			}

			root = el;

			this.startNode = el;
			this.endNode = el;
		}
		else {
			let singleEl = getSingleEl(fragment);
			this.root = singleEl || fragment; // We return the whole fragment when calling r() with a collection of nodes.

			Globals$1.nodeGroups.set(this.root, this);
			if (singleEl) {
				root = singleEl;
				offset = 1;
			}
		}

		this.updatePaths(root, shell.paths, offset);

		this.activateEmbeds(root, shell, offset);

		// Apply exprs
		this.applyExprs(template.exprs);
	}

	clearRenderWatched() {
		this.watchedExprPaths = {};
	}
}

function getSingleEl(fragment) {
	let nonempty = [];
	for (let n of fragment.childNodes) {
		if (n.nodeType === 1 || n.nodeType === 3 && n.textContent.trim().length) {
			if (nonempty.length)
				return null;
			nonempty.push(n);
		}
	}
	return nonempty[0];
}

/**
 * Does the fragment have one child that's an element matching the tagname of el?
 * @param fragment {DocumentFragment}
 * @param el {HTMLElement}
 * @returns {boolean} */
function isReplaceEl(fragment, el) {
	return el.tagName.includes('-')
		&& fragment.children.length===1
		&& fragment.children[0].tagName.replace('-SOLARITE-PLACEHOLDER', '') === el.tagName;
}

/**
 * The html strings and evaluated expressions from an html tagged template.
 * A unique Template is created for each item in a loop.
 * Although the reference to the html strings is shared among templates. */
class Template {

	/** @type {(Template|string|function)|(Template|string|function)[]} Evaulated expressions.  */
	exprs = []

	/** @type {string[]} */
	html = [];

	/** @type {Array} Used for toJSON() and getObjectHash().  Stores values used to quickly create a string hash of this template. */
	hashedFields;

	/** @type {NodeGroup} */
	nodeGroup;

	/**
	 *
	 * @param htmlStrings {string[]}
	 * @param exprs {*[]} */
	constructor(htmlStrings, exprs) {
		this.html = htmlStrings;
		this.exprs = exprs;

		//this.trace = new Error().stack.split(/\n/g)

		// Multiple templates can share the same htmlStrings array.
		//this.hashedFields = [getObjectId(htmlStrings), exprs]

		
	}

	/**
	 * Called by JSON.serialize when it encounters a Template.
	 * This prevents the hashed version from being too large. */
	toJSON() {
		if (!this.hashedFields)
			this.hashedFields = [getObjectId(this.html), this.exprs];

		return this.hashedFields
	}

	/**
	 * Render the main template, which may indirectly call renderTemplate() to create children.
	 * @param el {HTMLElement}
	 * @param options {RenderOptions}
	 * @return {?DocumentFragment|HTMLElement} */
	render(el=null, options={}) {
		let ng;
		let standalone = !el;
		let firstTime = false;

		// Rendering a standalone element.
		// TODO: figure out when to not use RootNodeGroup
		if (standalone) {
			ng = new RootNodeGroup(this, null, options);
			el = ng.getRootNode();
			Globals$1.nodeGroups.set(el, ng); // Why was this commented out?
			firstTime = true;
		}
		else {
			ng = Globals$1.nodeGroups.get(el);
			if (!ng) {
				ng = new RootNodeGroup(this, el, options);
				Globals$1.nodeGroups.set(el, ng); // Why was this commented out?
				firstTime = true;
			}

			// This can happen if we try manually rendering one template to a NodeGroup that was created expecting a different template.
			// These don't always have the same length, for example if one attribute has multiple expressions.
			if (ng.paths.length === 0 && this.exprs.length || ng.paths.length > this.exprs.length)
				throw new Error(`Solarite Error:  Parent HTMLElement ${ng.template.html.join('${...}')} and ${ng.paths.length} \${value} placeholders can't accomodate a Template with ${this.exprs.length} values.`);		}

		// Creating the root nodegroup also renders it.
		// If we didn't just create it, we need to render it.
		if (!firstTime) {
			if (this.html?.length === 1 && !this.html[0])
				el.innerHTML = ''; // Fast path for empty component.
			else {
				ng.clearRenderWatched();
				ng.applyExprs(this.exprs);
			}
		}

		return el;
	}

	getExactKey() {
		if (!this.exactKey)
			this.exactKey = getObjectHash(this); // calls this.toJSON().
		return this.exactKey;
	}

	getCloseKey() {
		if (!this.closeKey)
			this.closeKey = '@'+this.toJSON()[0];
		// Use the joined html when debugging?  But it breaks some tests.
		//return '@'+this.html.join('|')

		return this.closeKey;
	}
}


/**
 * @typedef {Object} RenderOptions
 * @property {boolean=} styles - Replace :host in style tags to scope them locally.
 * @property {boolean=} scripts - Execute script tags.
 * @property {boolean=} ids - Create references to elements with id or data-id attributes.
 * @property {?boolean} render - Deprecated.
 * 	 Used only when options are given to a class super constructor inheriting from Solarite.
 *     True to call render() immediately in super constructor.
 *     False to automatically call render() at all.
 *     Undefined (default) to call render() when added to the DOM, unless already rendered.
 */

/**
 * Convert strings to HTMLNodes.
 * Using r as a tag will always create a Template.
 * Using r() as a function() will always create a DOM element.
 *
 * Features beyond what standard js tagged template strings do:
 * 1. r`` sub-expressions
 * 2. functions, nodes, and arrays of nodes as sub-expressions.
 * 3. html-escape all expressions by default, unless wrapped in r()
 * 4. event binding
 * 5. TODO:  list more
 *
 * Currently supported:
 * 1. r(el, options)`<b>${'Hi'}</b>`   // Create template and render its nodes to el.
 * 2. r(el, template, ?options)        // Render the Template created by #1 to element.
 *
 * 3. r`<b>Hello</b> ${'World'}!`      // Create Template that can later be used to create nodes.
 *
 * 4. r('Hello');                      // Create single text node.
 * 5. r('<b>Hello</b>');               // Create single HTMLElement
 * 6. r('<b>Hello</b><u>Goodbye</u>'); // Create document fragment because there's more than one node.
 * 7. r()`Hello<b>${'World'}!</b>`     // Same as 4-6, but evaluates the string as a Solarite template, which
 *                                     // includes properly handling nested components and r`` sub-expressions.
 * 8. r(template)                      // Render Template created by #1.
 *
 * 9. r({render(){...}})              // Pass an object with a render method, and optionally other props/methods.
 *
 * @param htmlStrings {?HTMLElement|string|string[]|function():Template|{render:function()}}
 * @param exprs {*[]|string|Template|Object}
 * @return {Node|HTMLElement|Template} */
function r(htmlStrings=undefined, ...exprs) {

	// TODO: Make this a more flat if/else and call other functions for the logic.
	if (htmlStrings instanceof Node) {
		let parent = htmlStrings, template = exprs[0];

		// 1
		if (!(exprs[0] instanceof Template)) {
			if (parent.shadowRoot)
				parent.innerHTML = ''; // Remove shadowroot.  TODO: This could mess up paths?

			let options = exprs[0];

			// Return a tagged template function that applies the tagged themplate to parent.
			let taggedTemplate = (htmlStrings, ...exprs) => {
				Globals$1.rendered.add(parent);
				let template = new Template(htmlStrings, exprs);
				return template.render(parent, options);
			};
			return taggedTemplate;
		}

		// 2. Render template created by #4 to element.
		else if (exprs[0] instanceof Template) {
			let options = exprs[1];
			template.render(parent, options);

			// Append on the first go.
			if (!parent.childNodes.length && this) {
				// TODO: Is this ever executed?
				debugger;
				parent.append(this.rootNg.getParentNode());
			}
		}



		// null for expr[0], remove whole element.
		   // This path never happens?
		else {
			throw new Error('unsupported');
			//let ngm = NodeGroupManager.get(parent);
			//ngm.render(null, exprs[1])
		}
	}

	// 3. Path if used as a template tag.
	else if (Array.isArray(htmlStrings)) {
		return new Template(htmlStrings, exprs);
	}

	else if (typeof htmlStrings === 'string' || htmlStrings instanceof String) {
		// If it starts with a string, trim both ends.
		// TODO: Also trim if it ends with whitespace?
		if (htmlStrings.match(/^\s^</))
			htmlStrings = htmlStrings.trim();

		// We create a new one each time because otherwise
		// the returned fragment will have its content replaced by a subsequent call.
		let templateEl = document.createElement('template');
		templateEl.innerHTML = htmlStrings;

		// 4+5. Return Node if there's one child.
		let relevantNodes = Util.trimEmptyNodes(templateEl.content.childNodes);
		if (relevantNodes.length === 1)
			return relevantNodes[0];

		// 6. Otherwise return DocumentFragment.
		return templateEl.content;
	}

	// 7. Create a static element
	else if (htmlStrings === undefined) {
		return (htmlStrings, ...exprs) => {
			//Globals.rendered.add(parent)
			let template = r(htmlStrings, ...exprs);
			return template.render();
		}
	}

	// 8.
	else if (htmlStrings instanceof Template) {
		return htmlStrings.render();
	}


	// 9. Create dynamic element with render() function.
	else if (typeof htmlStrings === 'object') {
		let obj = htmlStrings;

		// Special rebound render path, called by normal path.
		if (Globals$1.objToEl.has(obj)) {
			return function(...args) {
			   let template = r(...args);
			   let el = template.render();
				Globals$1.objToEl.set(obj, el);
			}.bind(obj);
		}

		// Normal path
		else {
			Globals$1.objToEl.set(obj, null);
			obj.render(); // Calls the Special rebound render path above, when the render function calls r(this)
			let el = Globals$1.objToEl.get(obj);
			Globals$1.objToEl.delete(obj);

			for (let name in obj)
				if (typeof obj[name] === 'function')
					el[name] = obj[name].bind(el);
				else
					el[name] = obj[name];

			return el;
		}
	}

	else
		throw new Error('Unsupported arguments.')
}

//import {watchGet, watchSet} from "./watch.js";



function defineClass(Class, tagName, extendsTag) {
	if (!customElements.getName(Class)) { // If not previously defined.
		tagName = tagName || camelToDashes(Class.name);
		if (!tagName.includes('-'))
			tagName += '-element';

		let options = null;
		if (extendsTag)
			options = {extends: extendsTag};

		customElements.define(tagName, Class, options);
	}
}





/**
 * Create a version of the Solarite class that extends from the given tag name.
 * Reasons to inherit from this instead of HTMLElement.  None of these are all that useful.
 * 1.  customElements.define() is called automatically when you create the first instance.
 * 2.  Calls render() when added to the DOM, if it hasn't been called already.
 * 3.  Child elements are added before constructor is called.  But they're also passed to the constructor.
 * 4.  We can use this.html = r`...` to set html.
 * 5.  We have the onConnect, onFirstConnect, and onDisconnect methods.
 *     Can't figure out how to have these work standalone though, and still be synchronous.
 * 6.  Can we extend from other element types like TR?
 * 7.  Shows default text if render() function isn't defined.
 *
 * Advantages to inheriting from HTMLElement
 * 1.  Minimization won't break when it renames the Class and we call customElements.define() on the wrong name.
 * 2.  We can inherit from things like HTMLTableRowElement directly.
 * 3.  There's less magic, since everyone is familiar with defining custom elements.
 *
 * @param extendsTag {?string}
 * @return {Class} */
function createSolarite(extendsTag=null) {

	let BaseClass = HTMLElement;
	if (extendsTag && !extendsTag.includes('-')) {
		extendsTag = extendsTag.toLowerCase();

		BaseClass = Globals$1.elementClasses[extendsTag];
		if (!BaseClass) { // TODO: Use Cache
			BaseClass = document.createElement(extendsTag).constructor;
			Globals$1.elementClasses[extendsTag] = BaseClass;
		}
	}

	/**
	 * Intercept the construct call to auto-define the class before the constructor is called.
	 * @type {HTMLElement} */
	let HTMLElementAutoDefine = new Proxy(BaseClass, {
		construct(Parent, args, Class) {
			defineClass(Class, null, extendsTag);

			// This is a good place to manipulate any args before they're sent to the constructor.
			// Such as loading them from attributes, if I could find a way to do so.

			// This line is equivalent the to super() call.
			return Reflect.construct(Parent, args, Class);
		}
	});

	return class Solarite extends HTMLElementAutoDefine {
		
		
		/**
		 * TODO: Make these standalone functions.
		 * Callbacks.
		 * Use onConnect.push(() => ...); to add new callbacks. */
		onConnect = Util$1.callback();
		
		onFirstConnect = Util$1.callback();
		onDisconnect = Util$1.callback();

		/**
		 * @param options {RenderOptions} */
		constructor(options={}) {
			super();

			// TODO: Is options.render ever used?
			if (options.render===true)
				this.render();

			else if (options.render===false)
				Globals$1.rendered.add(this); // Don't render on connectedCallback()

			// Add slot children before constructor code executes.
			// This breaks the styleStaticNested test.
			// PendingChildren is setup in NodeGroup.createNewComponent()
			// TODO: Match named slots.
			//let ch = Globals.pendingChildren.pop();
			//if (ch) // TODO: how could there be a slot before render is called?
			//	(this.querySelector('slot') || this).append(...ch);

			/** @deprecated */
			Object.defineProperty(this, 'html', {
				set(html) {
					Globals$1.rendered.add(this);
					if (typeof html === 'string') {
						console.warn("Assigning to this.html without the r template prefix.");
						this.innerHTML = html;
					}
					else
						this.modifications = r(this, html, options);
				}
			});

			/*
			let pthis = new Proxy(this, {
				get(obj, prop) {
					return Reflect.get(obj, prop)
				}
			});
			this.render = this.render.bind(pthis);
			*/
		}

		/**
		 * Call render() only if it hasn't already been called.	 */
		renderFirstTime() {
			if (!Globals$1.rendered.has(this) && this.render)
				this.render();
		}
		
		/**
		 * Called automatically by the browser. */
		connectedCallback() {
			this.renderFirstTime();
			if (!Globals$1.connected.has(this)) {
				Globals$1.connected.add(this);
				this.onFirstConnect();
			}
			this.onConnect();
		}
		
		disconnectedCallback() {
			this.onDisconnect();
		}


		static define(tagName=null) {
			defineClass(this, tagName, extendsTag);
		}

		
	}
}

/**
 *
 *
 * Trying to be able to automatically watch primitive values.
 * TODO:
 * 1.  Have get() return Proxies for nested updates.
 * 2.  Override .map() for loops to capture changes.
 * 3.  Rename so we have watch.add() and watch.render() ?
 */

let unusedArg = Symbol('unusedArg');

/**
 * Custom map function triggers the get() Proxy.
 * @param array {Array}
 * @param callback {function}
 * @returns {*[]} */
function map(array, callback) {
	let result = [];
	for (let i=0; i<array.length; i++)
		result.push(callback(array[i], i, array));
	return result;
}


/**
 * This function markes a property of a web component to be watched for changes.
 *
 * Here is how watches work:
 * 1.  When we call watch3() it creates properties and proxies to watch when those values are set.
 * 2.  When they are set, we add their paths to a list of what to re-render.
 * 3.  Then we call renderWatched() to re-render only those parts.
 *
 * In more detail:
 * TODO
 *
 *
 * @param root {HTMLElement} Must be an instance of a Web Component.
 * @param field {string}
 * @param value {string|Symbol} */
function watch3(root, field, value=unusedArg) {
	// Store internal value used by get/set.
	if (value !== unusedArg)
		root[field] = value;
	else
		value = root[field];


	// use a single object for both defineProperty and new Proxy's handler.
	const handler = {
		get(obj, prop, receiver) {

			let result = (obj === receiver && field === prop)
				? value // top-level value.
				: Reflect.get(obj, prop, receiver); // avoid infinite recursion.

			// We override the map() function the first time render() is called.
			// But it's not re-overridden when we call renderWatched()
			if (prop === 'map') {

				// This outer function is so the ExprPath calls it as a function,
	 			// instead of it being evaluated immediately when the Template is created.
				return (callback) =>

					// This is the new map function.
					// TODO: Find a way to pass it a new obj when called from renderWatched
					function mapFunction() {
						let newObj = mapFunction.newValue || obj;
						Globals$1.currentExprPath.mapCallback = callback;
						return map(new Proxy(newObj, handler), callback);
					}
			}

			// Track which ExprPath is using this variable.
			else if (Globals$1.currentExprPath) {
				let rootNg = Globals$1.nodeGroups.get(root);

				// Init for field.
				rootNg.watchedExprPaths[field] = rootNg.watchedExprPaths[field] || new Set();
				rootNg.watchedExprPaths[field].add(Globals$1.currentExprPath); // Globals.currentExprPath is set in ExprPath.applyExact()
			}

			if (result && typeof result === 'object')
				return new Proxy(result, handler);

			return result;
		},


		// TODO: Will fail for attribute w/ a value having multiple ExprPaths.
		// TODO: This won't update a component's expressions.
		set(obj, prop, val, receiver) {

			// 1. Set the value.
			if (obj === receiver && field === prop)
				value = val; // top-level value.
			else // avoid infinite recursion.
				Reflect.set(obj, prop, val, receiver);

			// 2. Add to the list of ExprPaths to re-render.
			let rootNg = Globals$1.nodeGroups.get(root);
			for (let exprPath of rootNg.watchedExprPaths[field]) {

				// Update a single NodeGroup created by array.map()
				if (Array.isArray(obj) && parseInt(prop) == prop) {
					let exprsToRender = rootNg.exprsToRender.get(exprPath);

					// If we're not re-rendering the whole thing.
					if (exprsToRender !== true)
						Util$1.mapArrayAdd(rootNg.exprsToRender, exprPath, [obj, prop, val]);
				}

				// Reapply the whole expression.
				else
					rootNg.exprsToRender.set(exprPath, new NewValue(val)); // True means to re-render the whole thing.
			}
			return true;
		}
	};

	Object.defineProperty(root, field, {
		get: () => handler.get(root, field, root),
		set: (val) => handler.set(root, field, val, root)
	});
}

/**
 * Render the ExprPaths that were added to rootNg.exprsToRender.
 * @param root {HTMLElement}
 * @returns {Node[]} Modified elements.  */
function renderWatched(root) {
	let rootNg = Globals$1.nodeGroups.get(root);
	let modified = [];

	for (let [exprPath, params] of rootNg.exprsToRender) {

		// Reapply the whole expression.
		if (params instanceof NewValue) {

			// So it doesn't use the old value inside the map callback in the get handler above.
			// TODO: Find a more sensible way to pass newValue.
			exprPath.watchFunction.newValue = params.value;
			exprPath.apply([exprPath.watchFunction]);

			// TODO: freeNodeGroups() could be skipped if we updated ExprPath.apply() to never marked them as rendered.
			exprPath.freeNodeGroups();

			modified.push(...exprPath.getNodes());
		}

		// Update a single NodeGroup created by array.map()
		else {
			for (let row of params) {
				let [obj, prop, value] = row;
				let template = exprPath.mapCallback(value);
				exprPath.applyLoopItemUpdate(prop, template);

				modified.push(...exprPath.nodeGroups[prop].getNodes());
			}
		}
	}

	rootNg.exprsToRender = new Map(); // clear

	return modified;
}

/**
 * Wrap a value in a way that tells renderWatched() to take the first path and reapply the whole expression. */
class NewValue {
	constructor(value) {
		this.value = value;
	}
}

/**
 * Solarite JavasCript UI library.
 * MIT License
 * https://vorticode.github.io/solarite/
 */

/**
 * TODO: The Proxy and the multiple base classes mess up 'instanceof Solarite'
 * @type {Node|Class<HTMLElement>|function(tagName:string):Node|Class<HTMLElement>} */
let Solarite = new Proxy(createSolarite(), {
	apply(self, _, args) {
		return createSolarite(...args)
	}
});
let getInputValue = Util.getInputValue;
 // unfinished

export { ArgType, Globals$1 as Globals, Solarite, Template, delve, getArg, getInputValue, r, renderWatched, watch3 as watch };
