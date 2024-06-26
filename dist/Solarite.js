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
	


};



/**
 * Follow a path into an object.
 * @param obj {object}
 * @param path {string[]}
 * @param createVal {*}  If set, non-existant paths will be created and value at path will be set to createVal.
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
 * @param name {string} Attribute name.  Not case-sensitive.
 * @param val {*} Default value to use if attribute doesn't exist.
 * @param type {ArgType|function|*[]}
 *     If an array, use the value if it's in the array, otherwise return undefined.
 *     If it's a function, pass the value to the function and return the result.
 * @return {*} */
function getArg(el, name, val=null, type=ArgType.String) {
	let attrVal = el.getAttribute(name);
	if (attrVal !== null) // If attribute doesn't exist.
		val = attrVal;
		
	if (Array.isArray(type))
		return type.includes(val) ? val : undefined;
	
	if (typeof type === 'function')
		return type(val);
	
	// If bool, it's true as long as it exists and its value isn't falsey.
	if (type===ArgType.Bool) {
		let lAttrVal = typeof val === 'string' ? val.toLowerCase() : val;
		return !['false', '0', false, 0, null, undefined].includes(lAttrVal);
	}
	
	// Attribute doesn't exist
	switch (type) {
		case ArgType.Int:
			return parseInt(val);
		case ArgType.Float:
			return parseFloat(val);
		case ArgType.String:
			return val || '';
		case ArgType.JSON:
			try {
				return JSON.parse(val);
			} catch (e) {
				return val;
			}
		case ArgType.Eval:
			try {
				return eval(`(${val})`);
			} catch (e) {
				return val;
			}
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
 * @param prefix
 * @returns {string} */
function getObjectId(obj, prefix=null) {
	
	
	
	
	
	prefix = prefix || '~\f';
	
	// if (typeof obj === 'function')
	// 	return obj.toString();
	
	let result = objectIds.get(obj);
	if (!result) { // convert to string, store in result, then add 1 to lastObjectId.
		result = prefix+(lastObjectId++); // We use a unique prefix to ensure it doesn't collide w/ strings not from getObjectId()
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
	//return (isHashing && !Array.isArray(this)) ? getObjectId(this) : this
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
	catch(e){
		result = getObjectHashCircular(obj);
	}
	isHashing = false;
	return result;
}

/**
 * Having this separate might help the optimzer for getObjectHash() ?
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

	// Get all values for a key
	getAll(key) {
		return this.data[key] || [];
	}

	// Remove one value from a key, and return it
	delete(key, val=undefined) {
		// if (key === '["Html2",[[["Html3",["F1","A"]],["Html3",["F1","B"]]]]]')
		// 	debugger;
			
		let data = this.data;
		// The partialUpdate benchmark shows having this check first makes the function slightly faster.
		// if (!data.hasOwnProperty(key))
		// 	return undefined;

		// Delete a specific value.
		let result;
		let set = data[key];
		if (!set) // slower than pre-check.
		 	return undefined;

		if (val !== undefined) {
			set.delete(val);
			result = val;
		}

		// Delete any value.
		else {
			result = set.values().next().value;
			// [result] = set; // Does the same as above. is about the same speed?
			set.delete(result);
		}

		// TODO: Will this make it slower?
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

let Util = {

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

		let tagName = root.tagName.toLowerCase();
		for (let child of style.childNodes) {
			if (child.nodeType === 3) {
				let oldText = child.textContent;
				let newText = oldText.replace(/:host(?=[^a-z0-9_])/gi, tagName + '[data-style="' + styleId + '"]');
				if (oldText !== newText)
					child.textContent = newText;
			}
		}
	}


};



let div = document.createElement('div');

let isEvent = attrName => attrName.startsWith('on') && attrName in div;


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
 * Returns false if they're the same.  Or the first index where they differ.
 * @param a
 * @param b
 * @returns {int|false} */
function findArrayDiff(a, b) {
	if (a.length !== b.length)
		return -1;
	let aLength = a.length;
	for (let i=0; i<aLength; i++)
		if (a[i] !== b[i])
			return i;
	return false; // the same.
}


/**
 * TODO: Turn this into a class because it has internal state.
 * TODO: Don't break on 3<a inside a <script> or <style> tag.
 * @param html {?string} Pass null to reset context.
 * @returns {string} */
function htmlContext(html) {
	if (html === null) {
		state = {...defaultState};
		return state.context;
	}
	for (let i = 0; i < html.length; i++) {
		const char = html[i];
		switch (state.context) {
			case htmlContext.Text:
				if (char === '<' && html[i+1].match(/[a-z!]/i)) { // Start of a tag or comment.
					// if (html.slice(i, i+4) === '<!--')
					// 	state.context = htmlContext.Comment;
					// else
						state.context = htmlContext.Tag;
					state.buffer = '';
				}
				break;
			case htmlContext.Tag:
				if (char === '>') {
					state.context = htmlContext.Text;
					state.quote = null;
					state.buffer = '';
				} else if (char === ' ' && !state.buffer) {
					// No attribute name is present. Skipping the space.
					continue;
				} else if (char === ' ' || char === '/' || char === '?') {
					state.buffer = '';  // Reset the buffer when a delimiter or potential self-closing sign is found.
				} else if (char === '"' || char === "'" || char === '=') {
					state.context = htmlContext.Attribute;
					state.quote = char === '=' ? null : char;
					state.buffer = '';
				} else {
					state.buffer += char;
				}
				break;
			case htmlContext.Attribute:
				if (!state.quote && !state.buffer.length && (char === '"' || char === "'"))
					state.quote = char;

				else if (char === state.quote || (!state.quote && state.buffer.length)) {
					state.context = htmlContext.Tag;
					state.quote = null;
					state.buffer = '';
				} else if (!state.quote && char === '>') {
					state.context = htmlContext.Text;
					state.quote = null;
					state.buffer = '';
				} else if (char !== ' ') {
					state.buffer += char;
				}
				break;
		}

	}
	return state.context;
}


htmlContext.Attribute = 'Attribute';
htmlContext.Text = 'Text';
htmlContext.Tag = 'Tag';
//htmlContext.Comment = 'Comment';
let defaultState = {
	context: htmlContext.Text, // possible values: 'TEXT', 'TAG', 'ATTRIBUTE'
	quote: null, // possible values: null, '"', "'"
	buffer: '',
	lastChar: null
};
let state = {...defaultState};


// For debugging only


/**
 * Path to where an expression should be evaluated within a Shell.
 * Path is only valid until the expressions before it are evaluated.
 * TODO: Make this based on parent and node instead of path? */
class ExprPath {

	/**
	 * @type {PathType} */
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

	/** @deprecated */
	get parentNode() {
		return this.nodeMarker.parentNode;
	}

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

	// What are these?
	nodeBeforeIndex;
	nodeMarkerPath;

    // TODO: Keep this cached?
    expr;

    // for debugging
	

	/**
	 * @param nodeBefore {Node}
	 * @param nodeMarker {?Node}
	 * @param type {string}
	 * @param attrName {?string}
	 * @param attrValue {string[]} */
	constructor(nodeBefore, nodeMarker, type=PathType.Content, attrName=null, attrValue=null) {

		

		// If path is a node.
		this.nodeBefore = nodeBefore;
		this.nodeMarker = nodeMarker;
		this.type = type;
		this.attrName = attrName;
		this.attrValue = attrValue;
		if (type === PathType.Multiple)
			this.attrNames = new Set();
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
	 * onclick=${[this.doSomething, 'meow']}
	 * onclick=${[this, 'doSomething', 'meow']}
	 *
	 * @param node
	 * @param expr
	 * @param root */
	applyEventAttrib(node, expr, root) {
		

		let eventName = this.attrName.slice(2);
		let func;

		// Convert array to function.
		// TODO: This doesn't work for [this, 'doSomething', 'meow']
		let args = [];
		if (Array.isArray(expr)) {
			for (let i=0; i<expr.length; i++)
				if (typeof expr[i] === 'function') {
					func = expr[i];
					args = expr.slice(i+1);
					break;
				}

			// oninput=${[this, 'value']}
			if (!func) {
				func = setValue;
				args = [expr[0], expr.slice(1), node];
				node.value = delve(expr[0], expr.slice(1));
				//debugger;
			}
		}
		else
			func = expr;

		let eventKey = getObjectId(node) + eventName;
		let [existing, existingBound] = nodeEvents[eventKey] || [];
		nodeEventArgs[eventKey] = args; // TODO: Put this in nodeEvents[]


		if (existing !== func) {
			if (existing)
				node.removeEventListener(eventName, existingBound);

			let originalFunc = func;

			// BoundFunc sets the "this" variable to be the current Solarite component.
			let boundFunc = event => originalFunc.call(root, ...args, event, node);

			// Save both the original and bound functions.
			// Original so we can compare it against a newly assigned function.
			// Bound so we can use it with removeEventListner().
			nodeEvents[eventKey] = [originalFunc, boundFunc];

			node.addEventListener(eventName, boundFunc);

			// TODO: classic event attribs:
			//el[attr.name] = e => // e.g. el.onclick = ...
			//	(new Function('event', 'el', attr.value)).bind(this.manager.rootEl)(e, el) // put "event", "el", and "this" in scope for the event code.
		}
	}

	applyValueAttrib(node, exprs, exprIndex) {
		let expr = exprs[exprIndex];
		
		// Array for form element data binding.
		// TODO: This never worked, and was moved to applyEventAttrib.
		// let isArrayValue = Array.isArray(expr);
		// if (isArrayValue && expr.length >= 2 && !expr.slice(1).find(v => !['string', 'number'].includes(typeof v))) {
		// 	node.value = delve(expr[0], expr.slice(1));
		// 	node.addEventListener('input', e => {
		// 		delve(expr[0], expr.slice(1), node.value) // TODO: support other properties like checked
		// 	});
		// }

		// Values to toggle an attribute
		if (!this.attrValue && (expr === false || expr === null || expr === undefined))
			node.removeAttribute(this.attrName);
		
		else if (!this.attrValue && expr === true)
			node.setAttribute(this.attrName, '');

		// Regular attribute
		else {
			let value = [];

			// We go backward because NodeGroup.applyExprs() calls this function, and it goes backward through the exprs.
			if (this.attrValue) {
				for (let i=this.attrValue.length-1; i>=0; i--) {
					value.unshift(this.attrValue[i]);
					if (i > 0) {
						let val = exprs[exprIndex];
						if (val !== false && val !== null && val !== undefined)
							value.unshift(val);
						exprIndex--;
					}
				}

				exprIndex ++;
			}
			else
				value.unshift(expr);

			let joinedValue = value.join('');
			node.setAttribute(this.attrName, joinedValue);

			// This is needed for setting input.value, .checked, option.selected, etc.
			// But in some cases setting the attribute is enough.  such as div.setAttribute('title') updates div.title.
			// TODO: How to tell which is which?
			if (this.attrName in node)
				node[this.attrName] = joinedValue;

		}

		return exprIndex;
	}


	/**
	 *
	 * @param newRoot {HTMLElement}
	 * @return {ExprPath} */
	clone(newRoot) {
		

        // Resolve node paths.
		let nodeMarker, nodeBefore;
        let root = newRoot;
        let path = this.nodeMarkerPath;
        for (let i=path.length-1; i>0; i--)
            root = root.childNodes[path[i]];
		let childNodes = root.childNodes;
        nodeMarker = childNodes[path[0]];
        if (this.nodeBefore)
            nodeBefore = childNodes[this.nodeBeforeIndex];

		let result = new ExprPath(nodeBefore, nodeMarker, this.type, this.attrName, this.attrValue);

		

		return result;
	}
	
	/**
	 * Clear the nodeCache of this ExprPath, as well as all parent and child ExprPaths that
	 * share the same DOM parent node.
	 *
	 * TODO: Is recursive clearing ever necessary?
	 */
	clearNodesCache() {
		let path = this;
		
		// Clear cache parent ExprPaths that have the same parentNode
		let parentNode = this.parentNode;
		while (path && path.parentNode === parentNode) {
			path.nodesCache = null;
			path = path.parentNg?.parentPath;
			
			// If stuck in an infinite loop here, the problem is likely due to Template hash colisions.
			// Which cause one path to be the descendant of itself, creating a cycle.
		}
		
		function clearChildNodeCache(path) {
			
			// Clear cache of child ExprPaths that have the same parentNode
			for (let ng of path.nodeGroups) {
				if (ng) // Can be null from applyOneExpr()'s push(null) call.
					for (let path2 of ng.paths) {
						if (path2.type === PathType.Content && path2.parentNode === parentNode) {
							path2.nodesCache = null;
							clearChildNodeCache(path2);
						}
					}
			}
		}
		
		clearChildNodeCache(this);
	}


	/**
	 * Attempt to remove all of this ExprPath's nodes from the DOM, if it can be done using a special fast method.
	 * @returns {boolean} Returns false if Nodes werne't removed, and they should instead be removed manually. */
	fastClear() {
		let parent = this.nodeBefore.parentNode;
		if (this.nodeBefore === parent.firstChild && this.nodeMarker === parent.lastChild) {

			// If parent is the only child of the grandparent, replace the whole parent.
			// And if it has no siblings, it's not created by a NodeGroup/path.
			let grandparent = parent.parentNode;
			if (grandparent && parent === grandparent.firstChild && parent === grandparent.lastChild && !parent.hasAttribute('id')) {
				let replacement = document.createElement(parent.tagName);
				replacement.append(this.nodeBefore, this.nodeMarker);
				for (let attrib of parent.attributes)
					replacement.setAttribute(attrib.name, attrib.value);
				parent.replaceWith(replacement);
			}
			else {
				parent.innerHTML = ''; // Faster than calling .removeChild() a thousand times.
				parent.append(this.nodeBefore, this.nodeMarker);
			}
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
		/*result = this.nodesCache;
		if (result) {
			
			
			
			return result
		}*/

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
	
	removeNodeGroup(ng) {
		let idx = this.nodeGroups.indexOf(ng);
		
		this.nodeGroups.splice(idx);
		ng.parentPath = null;
		this.clearNodesCache();
	}

	
}



/**
 *
 * @param root
 * @param path {string[]}
 * @param node {HTMLElement}
 */
function setValue(root, path, node) {
	let val = node.value;
	if (node.type === 'number')
		val = parseFloat(val);

	delve(root, path, val);
	
	//this.render();
}

/** @enum {string} */
const PathType = {
	/** Child of a node */
	Content: 'content',
	
	/** One or more whole attributes */
	Multiple: 'attrName',
	
	/** Value of an attribute. */
	Value: 'attrValue',
	
	/** Value of an attribute being passed to a component. */
	Component: 'component',
	
	/** Expressions inside Html comments. */
	Comment: 'comment',
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


// TODO: Memory from this is never freed.  Use a WeakMap<Node, Object<eventName:string, function[]>>
let nodeEvents = {};
let nodeEventArgs = {};

/**
 * A Shell is created from a tagged template expression instantiated as Nodes,
 * but without any expressions filled in. */
class Shell {

	/**
	 * @type {DocumentFragment} Parent of the shell nodes. */
	fragment;

	/** @type {ExprPath[]} Paths to where expressions should go. */
	paths = [];

	/** @type {?Template} Template that created this element. */
	template;

	// Embeds and ids
	events = [];

	/** @type {int[][]} Array of paths */
	ids = [];
	scripts = [];
	styles = [];

	staticComponents = [];


	/**
	 * Create the nodes but without filling in the expressions.
	 * This is useful because the expression-less nodes created by a template can be cached.
	 * @param html {string[]} */
	constructor(html=null) {
		if (!html)
			return;

		

		// 1.  Add placeholders
		// We increment the placeholder char as we go because nodes can't have the same attribute more than once.
		let placeholder = 0xe000; // https://en.wikipedia.org/wiki/Private_Use_Areas  6400.

		let buffer = [];
		let commentPlaceholder = `<!--!✨!-->`;
		let componentNames = {};

		htmlContext(null); // Reset the context.
		for (let i=0; i<html.length; i++) {
			let lastHtml = html[i];
			let context = htmlContext(lastHtml);

			// Swap out Embedded Solarite Components with ${} attributes.
			// Later, NodeGroup.render() will search for these and replace them with the real components.
			// Ctrl+F "redcomponent-placeholder" in project to find all code that manages subcomponents.
			if (context === htmlContext.Attribute) {

				let lastIndex, lastMatch;
				lastHtml.replace(/<[a-z][a-z0-9]*-[a-z0-9-]+/ig, (match, index) => {
					lastIndex = index+1; // +1 for after opening <
					lastMatch = match.slice(1);
				});

				if (lastMatch) {
					let newTagName = lastMatch + '-redcomponent-placeholder';
					lastHtml = lastHtml.slice(0, lastIndex) + newTagName + lastHtml.slice(lastIndex + lastMatch.length);
					componentNames[lastMatch] = newTagName;
				}
			}

			buffer.push(lastHtml);
			//console.log(lastHtml, context)
			if (i < html.length-1)
				if (context === htmlContext.Text)
					buffer.push(commentPlaceholder); // Comment Placeholder. because we can't put text in between <tr> tags for example.
				else
					buffer.push(String.fromCharCode(placeholder+i));
		}

		// 2. Create elements from html with placeholders.
		let template = document.createElement('template'); // Using a single global template won't keep the nodes as children of the DocumentFragment.
        let joinedHtml = buffer.join('');
		
		// Replace '-redcomponent-placeholder' close tags.
		// TODO: is there a better way?  What if the close tag is inside a comment?
		for (let name in componentNames)
			joinedHtml = joinedHtml.replaceAll(`</${name}>`, `</${componentNames[name]}>`);
		
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
				for (let attr of node.attributes) {

					// Whole attribute
					let matches = attr.name.match(/^[\ue000-\uf8ff]$/);
					if (matches) {
						this.paths.push(new ExprPath(null, node, PathType.Multiple));
						node.removeAttribute(matches[0]);
					}

					// Just the attribute value.
					else {
						let parts = attr.value.split(/[\ue000-\uf8ff]/g);
						if (parts.length > 1) {
							let nonEmptyParts = (parts.length === 2 && !parts[0].length && !parts[1].length) ? null : parts;
							this.paths.push(new ExprPath(null, node, PathType.Value, attr.name, nonEmptyParts));
							node.setAttribute(attr.name, parts.join(''));
						}
					}
				}
			}
			// Replace comment placeholders
			else if (node.nodeType === Node.COMMENT_NODE && node.nodeValue === '!✨!') {

				// Get or create nodeBefore.
				let nodeBefore = node.previousSibling; // Can be the same as another Path's nodeMarker.
				if (!nodeBefore) {
					nodeBefore = document.createComment('PathStart:'+this.paths.length);
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
					nodeMarker.textContent = 'PathEnd:'+ this.paths.length;
				}
				



				let path = new ExprPath(nodeBefore, nodeMarker, PathType.Content);
				
				this.paths.push(path);
			}
			
			
			// Sometimes users will comment out a block of html code that has expressions.
			// Here we look for expressions in comments.
			// We don't actually update them dynamically, but we still add paths for them.
			// That way the expression count still matches.
			else if (node.nodeType === Node.COMMENT_NODE) {
				let parts = node.textContent.split(/[\ue000-\uf8ff]/g);
				for (let i=0; i<parts.length-1; i++) {
					let path = new ExprPath(node.previousSibling, node);
					path.type = PathType.Comment;
					
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
						let path = new ExprPath(node.previousSibling, node, PathType.Content);
						
						this.paths.push(path);

						
					}

					// Removing them here will mess up the treeWalker.
					toRemove.push(node);
				}
			}
		}
		toRemove.map(el => el.remove());

		// Handle redcomponent-placeholder's.
		// Ctrl+F "redcomponent-placeholder" in project to find all code that manages subcomponents.
		//if (componentNames.size)
		//	this.components = [...this.fragment.querySelectorAll([...componentNames].join(','))]

		// Rename "is" attributes so the Web Components don't instantiate until we have the values of their PathExpr arguments.
		// that happens in NodeGroup.applyComponentExprs()
		for (let el of this.fragment.querySelectorAll('[is]')) {
			el.setAttribute('_is', el.getAttribute('is'));
		//	this.components.push(el);
		}

		for (let path of this.paths) {
			if (path.nodeBefore)
				path.nodeBeforeIndex = Array.prototype.indexOf.call(path.nodeBefore.parentNode.childNodes, path.nodeBefore);
			path.nodeMarkerPath = getNodePath(path.nodeMarker);

			// Cache so we don't have to calculate this later inside NodeGroup.applyExprs()
			if (path.type === PathType.Value && path.nodeMarker.nodeType === 1 &&
				(path.nodeMarker.tagName.includes('-') || path.nodeMarker.hasAttribute('is'))) {
				path.type = PathType.Component;
			}
		}


		this.findEmbeds();


		
	} // end constructor

	/**
	 * We find the path to every embed here once in the Shell, instead of every time a NodeGroup is instantiated.
	 * When a Nodegroup is created, it calls NodeGroup.activateEmbeds() that uses these paths. */
	findEmbeds() {
		this.scripts = Array.prototype.map.call(this.fragment.querySelectorAll('scripts'), el => getNodePath(el));
		this.styles = Array.prototype.map.call(this.fragment.querySelectorAll('style'), el => getNodePath(el));

		let idEls = this.fragment.querySelectorAll('[id],[data-id]');
		

		// Check for valid id names.
		for (let el of idEls) {
			let id = el.getAttribute('data-id') || el.getAttribute('id');
			if (div.hasOwnProperty(id))
				throw new Error(`<${el.tagName.toLowerCase()} id="${id}"> can't override existing HTMLElement property.`)
		}


		this.ids = Array.prototype.map.call(idEls, el => getNodePath(el));

		// Events (not yet used)
		for (let el of this.fragment.querySelectorAll('*')) {
			for (let attrib of el.attributes)
				if (isEvent(attrib.name))
					this.events.push([attrib.name, getNodePath(el)]);

			if (el.tagName.includes('-') || el.hasAttribute('_is'))

				// Dynamic components have attributes with expression values.
				// They are created from applyExprs()
				// But static components are created in a separate path inside the NodeGroup constructor.
				if (!this.paths.find(path => path.nodeMarker === el))
					this.staticComponents.push(getNodePath(el));
		}

	}

	/**
	 * Get the shell for the html strings.
	 * @param htmlStrings {string[]}
	 * @returns {Shell} */
	static get(htmlStrings) {
		let result = shells.get(htmlStrings);
		if (!result) {
			result = new Shell(htmlStrings);
			shells.set(htmlStrings, result); // cache
		}

		
		return result;
	}

	
}

let shells = new WeakMap();

/**
 * The html strings and evaluated expressions from an html tagged template.
 * A unique Template is created for each item in a loop.
 * Although the reference to the html strings is shared among templates. */
class Template {

	/** @type {(Template|string|function)|(Template|string|function)[]} Evaulated expressions.  */
	exprs = []

	/** @type {string[]} */
	html = [];

	/**
	 * If true, use this template to replace an existing element, instead of appending children to it.
	 * @type {?boolean} */
	replaceMode;

	/** Used for toJSON() and getObjectHash().  Stores values used to quickly create a string hash of this template. */
	hashedFields;

    /**
     * @deprecated
     * @type {ExprPath} Used with forEach() from watch.js
   	 * Set in NodeGroup.applyOneExpr() */
    parentPath;
	
	/** @type {NodeGroup} */
	nodeGroup;
	
	/**
	 * @type {string[][]} */
	paths = [];

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
			this.hashedFields = [getObjectId(this.html, 'Html'), this.exprs];
		
		return this.hashedFields
	}

	toNode() {
		let ngm = new NodeGroupManager();
		return ngm.render(this);
	}

	getCloseKey() {
		// Use the joined html when debugging?
		//return '@'+this.html.join('|')

		return '@'+this.hashedFields[0];
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
 * Tools for watch variables and performing precise renders.
 */


/**
 * Stores info how to transform a path to a template. */
class TransformerInfo {
	constructor(path, transformer, hash) {
		this.path = path;
		this.transformer = transformer;
		this.hash = hash;
	}
}


/**
 * Maps an object path to the function that converts it to a Template.
 * Once it's convert to a template, we can get the hash of that Tempate.
 * Then that hash tells us what NodeGroups are affected by the object.
 *
 * We store the function to get the Template, instead of the Template itself,
 * so we can call that function again when the object has a new value.
 * @type {MultiValueMap<Object, function(...Object):Template>} */
let pathToTransformer = new MultiValueMap(); // uses a Set() for each value.

/**
 *
 * @param objectPaths {(*|function)[]}
 * @returns {Template} */
function watchGet(...objectPaths) {
	
	/** @type {function} */
	let transformer = objectPaths.at(-1);
	let paths;
	if (typeof transformer === 'function') {
		paths = objectPaths.slice(0, -1);
	}

	// No transformer provided, so we create our own.
	else if (objectPaths.length === 1) {
		paths = [objectPaths[0].slice(0, -1)];
		let prop = objectPaths[0].at(-1);
		transformer = (...args) => (args[0][prop]);
	}

	
	// Save arguments used to call the template, so we can call it again when those args have their values change.
	let args = [];
	for (let path of paths) {


		let obj = delve(watchSet(path[0]), path.slice(1));
		args.push(obj);
	}
	
	let template = transformer(...args);
	
	// If the result isn't a Template, convert the function to return a Template that wraps the result.
	// This way NodeGroupManager.findAndDelete() can find a NodeGroup that matches this Template's hash.
	if (!(template instanceof Template)) {
		let oldToTemplate = transformer;
		transformer = function() {
			return new Template(['', ''], [oldToTemplate(...arguments)]);
		};
		template = transformer(...args);
	}
	
	// Map the object paths to the function that creates a template.
	let hash = getObjectHash(template);
	for (let path of paths) {
		let serializedPath = serializePath(path);
		pathToTransformer.add(serializedPath, new TransformerInfo(path, transformer, hash)); // Uses a Set() to ensure no duplicates.
	}

	return template;
}

//let proxyCache = new WeakMap();


/**
 * Set the value of a variable in a way that's watched, so later when we call .renderWatched()
 * We can find what NodeGroups to update.*/
function watchSet(obj) {
	if (obj?.$isProxy===true)
		return obj; // It's already a Proxy.

	// This cache doesn't make things faster.
	// let result = proxyCache.get(obj);
	// if (!result) {
	// 	result = new Proxy(obj, new ProxyHandler(obj));
	// 	proxyCache.set(obj, result);
	// }
	// return result;
	return new Proxy(obj, new ProxyHandler$1(obj));
}

/**
 * Loop over each item and apply watchGet() to each item.
 * @param arrayPath {*[]}
 * @param callback {function(obj:Object, index:int):Template}
 * @returns {Template} */
function forEach(arrayPath, callback) {
	let array = delve(arrayPath[0], arrayPath.slice(1));

	// This is retrieved on the 'insert' path inside renderWatched()
	let ngm = NodeGroupManager.get(arrayPath[0]);
	if (ngm.clearSubscribers) {
		ngm.clearSubscribers = false;
		ngm.pathToLoopInfo = new MultiValueMap();
	} // TODO: Move tis into NodeGroupMAnager.get() without breaking things?


	let newItems = [...array.map((item, i) => {
			// TODO: This needs to wrap callback so we can pass it the index also.
			return watchGet([...arrayPath, i], callback); // calls callback(array[i], i)
		})
	];

	// We return a template that wraps the array
	// So that NodeGroup.applyOneExpr can set the ExprPath and nextSibling on the template.
	// Then the 'insert' path in renderWatched() uses that data fora dding more nodes.
	let result = new Template(['', ''], [newItems]);


	// We get a unique hash for each foreach template because the [''] array is unique each time.
	let loopInfo = new LoopInfo(result, callback);
	ngm.pathToLoopInfo.add(serializePath(arrayPath), loopInfo);
	return result;
}

function serializePath(path) {
	// Convert any array indices to strings, so serialized comparisons work.
	return JSON.stringify([getObjectId(path[0]), ...path.slice(1).map(item => item+'')])

}


/**
 * When an object property is accessed, a new Proxy with a new instance of this handler class is created,
 * but it tracks the path from the root to the property.
 * That way when a property is set, it can report the changed path. */
class ProxyHandler$1 {
	
	/**
	 * @param root An element managed by a NodeGroupManager.  The same as the NodeGroupManager's rootEl.
	 * @param path {string[]} Used internally. */
	constructor(root, path=[]) {
		
		this.root = root;
		this.path = path; // path from root to this Proxy.
	}

	/**
	 * @param obj {Object}
	 * @param prop {string} */
	get(obj, prop) {
		
		// Special props.  Currently unused.
		// if (prop === '$path')
		// 	return this.path;
		// if (prop === '$root')
		// 	return this.root;
		if (prop === '$isProxy')
		 	return true;
		
		
		// 1. Array.splice()
		if (prop === 'splice' && Array.isArray(obj)) {
			return (index, deleteCount, ...items) => {
				let ngm = NodeGroupManager.get(this.root);

				if (deleteCount) {

					// Get the hash of each object along the delete range.  The process to get the hash is:
					// Serialized Path -> transformer -> Template -> hash.
					let hashes = [];
					for (let i=index; i<index+deleteCount; i++) {
						let serializedPath = serializePath([this.root, ...this.path, i+'']);

						let obj = delve(this.root, [...this.path, i]);
						for (let transformerInfo of pathToTransformer.getAll(serializedPath)) {
							let template = transformerInfo.transformer(obj);
							let hash = getObjectHash(template);
							hashes.push(hash); // Hashes may go to nodes in more than one loop.
						}
					}

					ngm.changes.push(new Change('delete', this.root, [...this.path, index+''], hashes));
				}

				//let oldArray = [...obj];
				let result = obj.splice(index, deleteCount);

				// Inserting
				if (items.length) {

					let beforeNgs;
					for (let loopInfo of ngm.getLoopInfo([this.root, ...this.path])) {
						let beforeObj = delve(this.root, [...this.path, index]);

						// Find where to insert before.
						if (beforeObj) {
							let beforeTemplate = loopInfo.itemTransformer(beforeObj);
							let beforeHash = getObjectHash(beforeTemplate);
							beforeNgs = ngm.nodeGroupsAvailable.data[beforeHash];

							if (beforeNgs) {
								let hash = getObjectHash(loopInfo.template);
								let loopNgs = ngm.nodeGroupsAvailable.data[hash] || [];
								for (let loopNg of loopNgs)
									for (let beforeNg of beforeNgs)
										if (beforeNg.startNode.parentNode === loopNg.startNode.parentNode)
											ngm.changes.push(new Change('insert', this.root, [...this.path, index + ''], items, beforeTemplate));
							}
						}
						if (!beforeNgs)
							ngm.changes.push(new Change('insert', this.root, [...this.path, index + ''], items));
					}
					obj.splice(index, 0, ...items);
				}
				return result;
			}
		}
		


		// 2.  Get property
		// If we're getting an object or array property, apply watch() to it recursively.
		let result = Reflect.get(obj, prop);
		if (result && typeof result === 'object') {
			let handler = new ProxyHandler$1(this.root, [...this.path, prop]); // same root, one level deeper on the path.
			return new Proxy(result, handler);
		}

		return result;
	}


	set(obj, prop, newValue) {
		let ngm = NodeGroupManager.get(this.root);
		ngm.changes.push(new Change('set', this.root, [...this.path, prop], newValue));
		return Reflect.set(obj, prop, newValue)
	}
}


/**
 *
 */
class Change {
	
	/**
	 * @param action {string}
	 * @param root {Object|Array}
	 * @param path {string[]}
	 * @param value
	 *	 If setting a value, this is the new value.
	 *	 If deleting from an array, this is an array of all the NodeGroups to delete.
	 *
	 * @param beforeTemplate
	 * */
	constructor(action, root, path, value, beforeTemplate=null) {
		this.action = action;

		// TODO: Store root as first item of path, to be consistent with code elsewhere.
		this.root = root;
		this.path = path;
		this.value = value;
		this.beforeTemplate = beforeTemplate;

		/** @type {TransformerInfo[]} */
		this.transformerInfo = [];

		// Traverse up the path.
		for (let i=this.path.length; i>0; i--) {
			let path = this.path.slice(0, i);
			let fullPath = [this.root, ...path];

			let serializedPath = getObjectHash(fullPath); // TODO: Why not serializedPath() ?
			this.transformerInfo.push(...pathToTransformer.getAll(serializedPath));
		}
	}
}

let logGets = false;
let gets = [];

let withinSet = 0;

/**
 * Turn the props on obj into JavasCript properties that return Proxies when accessed.
 * If called more than once, return the already-converted object.
 * @param obj {Object}
 * @param props {string}
 * @returns {*|{$proxyHandler}}
 */
function watch(obj, ...props) {
	
	if (props.length) {
		let internalProps = {};
		for (let prop of props) {
			internalProps[prop] = obj[prop];
			Object.defineProperty(obj, prop, {
				get() {
					return new Proxy(obj, new ProxyHandler(obj, [], internalProps))[prop];
				},
				set(value) {
					return watch(this)[prop] = value;
				}
			});
		}
		return;
	}
	
	
	if (obj?.$proxyHandler)
		return obj; // It's already a Proxy.
	
	// This cache doesn't make things faster.
	// But could it save memory?
	// let result = proxyCache.get(obj);
	// if (!result) {
	// 	result = new Proxy(obj, new ProxyHandler(obj));
	// 	proxyCache.set(obj, result);
	// }
	// return result;
	
	return new Proxy(obj, new ProxyHandler(obj));
}

/**
 * Provides methods used when a Proxied version of a property is accessed on an object returned by watch() */
class ProxyHandler {
	
	serializedPath;
	
	/**
	 * @param root An element managed by a NodeGroupManager.  The same as the NodeGroupManager's rootEl.
	 * @param path {string[]} Used internally.
	 * @param props */
	constructor(root, path=[], props=null) {
		
		this.root = root;
		this.path = path; // path from root to this Proxy.
		this.props = props;
	}
	
	/**
	 * Get the full path to this property from the root watched object.
	 * @param atIndex
	 * @returns {string} */
	getSerializedPath(atIndex=null) {
		if (!this.serializedPath)
			this.serializedPath = JSON.stringify([getObjectId(this.root), ...this.path.map(item => item + '')]);
			
		if (atIndex!== null)
			return this.serializedPath.slice(0, -1) + ',"' + atIndex + '"]';
		return this.serializedPath;
	}
	
	/**
	 * Return a ProxyHandler for a property one level deeper at pathItem.
	 * @param pathItem {string}
	 * @returns {ProxyHandler} */
	extend(pathItem) {
		pathItem += '';
		assert(!this.root.$proxyHandler);
		let result = new ProxyHandler(this.root, [...this.path, pathItem], this.props);
		if (this.serializedPath)
			result.serializedPath = this.getSerializedPath(pathItem);
		
		return result;
	}
	
	/**
	 * Called directly by JavaScript when accessing the value of a property.
	 * @param obj {Object}
	 * @param prop {string} */
	get(obj, prop) {
		
		// 1.  Special props.
		if (prop === '$proxyHandler')
			return this;
		else if (prop === '$removeProxy')
			return delve(this.props || this.root, this.path);
		
		// 2. Array functions.
		else if (prop === 'map' && Array.isArray(obj)) {
			
			let ngm = NodeGroupManager.get(this.root);
			ngm.clearSubscribersIfNeeded();
			
			return callback => {
				let loopInfo;
				
				let children = [];
				let transformer = obj => {
					let templates = [];
					
					for (let i = 0; i < obj.length; i++) {

						// Watch obj[i].
						let handler = this.extend(i);
						let item = obj[i];
						if (!item.$proxyHandler)
							item = new Proxy(item, handler);

						let template = callback(item, i, obj);
						templates.push(template);

						// If the loop is re-evaluted via Set() then we add duplicate TemplateInfo's
						//if (!withinSet) {
							let spath = this.getSerializedPath(i);
							let subscriber = new Subscriber(callback, template);
							subscriber.parent = loopInfo;
							ngm.subscribers.add(spath, subscriber);
							children.push([spath, subscriber]);
						//}
					}
					
					// A parent Template that surrounds all the items in the loop.
					// This lets us get template.nodeGroup.endNode so we can insertBefore().
					return new Template(['', ''], [templates]);
				};

				if (!withinSet)
					loopInfo = new Subscriber(transformer, null, callback);
				let wholeLoopTemplate = transformer(obj);
				if (!withinSet) {
					loopInfo.template = wholeLoopTemplate;
					loopInfo.children = children;
					ngm.subscribers.add(this.getSerializedPath(), loopInfo);
				}
				return wholeLoopTemplate;
			}
		}

		else if ((prop ==='splice' || prop === 'fastSplice') && Array.isArray(obj)) {
			let ngm = NodeGroupManager.get(this.root);
			return (index, deleteCount, ...items) => {
				let diff = items.length - deleteCount;
                let objLength = obj.length;
				
				// Delete
				if (deleteCount) {
					for (let i=index; i<index+deleteCount; i++) {
						
						// Update pathToTemplates
						let spath = this.getSerializedPath(i);
						
						// Delete nodes of associated NodeGroups.
						for (let subscriber of ngm.subscribers.data[spath] || []) {
							let ng = subscriber.template.nodeGroup;
							for (let node of ng.getNodes())
								node.remove();
							
							// Delete NodeGroup from NodeGroupManager.
							ngm.nodeGroupsAvailable.delete(ng.exactKey, ng);
						}
						
						delete ngm.subscribers.data[spath]; // Deletes templates associated with every loop where this is used.
					}
				}
				
				// Update indices of subsequent items.
				if (diff) {
					let loopPath = this.getSerializedPath();
					let loopInfo = [...ngm.subscribers.getAll(loopPath)][0]; // TODO: Handle multiple loops.
					
					let move = (oldIndex) => {
                        let newIndex = oldIndex+diff;
						let oldPath = this.getSerializedPath(oldIndex);
						let newPath = this.getSerializedPath(newIndex);

						let subscribers = ngm.subscribers.data[oldPath];
						delete ngm.subscribers.data[oldPath]; // TODO: Some can be overwritten w/o being deleted?
						ngm.subscribers.data[newPath] = subscribers;

						
						// Update associated NodeGroups by passing them newIndex.
						// This is unnecessary for most loops since they don't use the index.
						// fastSplice skips this path, it skips updating item indices.
						if (prop === 'splice') {
							let array = delve(this.root, this.path);
							for (let subscriber of subscribers) {
								let ng = subscriber.template.nodeGroup;
								
								let item = array[oldIndex];

								//assert(!item.$proxyHandler)
								let proxyItem = getProxy(item, this, this.path, newIndex); //new Proxy(item, this.extend(newIndex));
								let exprs = loopInfo.itemTransformer(proxyItem, newIndex).exprs; // TODO: Pass updated array as third argument to transformer.
								ng.applyExprs(exprs); // this is the slow part.
							}
						}
					};
					
					// Iterate in different directions depending on whether diff is positive or negative.
					if (diff > 0) // Moving items to the right, so we iterate backward from the end.
						for (let i = objLength-1; i >= index + items.length + deleteCount; i--)
							move(i);

					else // Moving items to the left, so we iterate forward.
						for (let i = index + items.length + deleteCount; i < objLength; i++)
							move(i);
				}
				
				
				// Add new items
				if (items.length) {
					let loopPath = this.getSerializedPath();
					
					let beforePath = this.getSerializedPath(index);
					let ngm = NodeGroupManager.get(this.root);
					
					for (let loopInfo of ngm.subscribers.getAll(loopPath)) {
						let beforeNodes = index < objLength - deleteCount
							? [...ngm.subscribers.getAll(beforePath)].map(t => t.template.nodeGroup.startNode)
							: [loopInfo.template.nodeGroup.endNode];
						for (let beforeNode of beforeNodes) { // TODO: Need to match the beforeNg with the loopInfo instead of iterating.
							for (let i = 0; i < items.length; i++) {
								
								// Create NodeGroup of new item.
								let itemHandler = this.extend(index + i);
								assert(!items[i].$proxyHandler);
								let proxyItem = new Proxy(items[i], itemHandler);
								let template = loopInfo.itemTransformer(proxyItem);
								let ng = ngm.getNodeGroup(template, null, true);
								
								
								for (let node of ng.getNodes()) {
									beforeNode.parentNode.insertBefore(node, beforeNode);
									//loopInfo.template.nodeGroup.endNode = node; // The loop's end node is actually an empty text node, so don't do this.
								}
								
								
								// Add new items to ngm.templateInfo
								let spath = itemHandler.getSerializedPath();
								let subscriber = new Subscriber(loopInfo.itemTransformer, template);
								subscriber.parent = loopInfo;
								ngm.subscribers.add(spath, subscriber);
							}
						}
						loopInfo.template.nodeGroup.parentPath.clearNodesCache();
						loopInfo.template.nodeGroup.nodesCache = null;
					}
				}
				
				let result = obj.splice(index, deleteCount, ...items);
				
				//this.notify(this.path);
				
				return result;
			}
		}

		// Allow these functions to use proxied objects as arguments.
		else if (prop ==='indexOf' && Array.isArray(obj)) {
			return item => {
				return obj.indexOf(item.$removeProxy || item)
			}
		}

		// 3.  Get property
		else {

			let obj2 = obj === this.root && this.props ? this.props : obj;
			let result = Reflect.get(obj2, prop);

			// This is read by watchFunction() which is called in NodeGroup.applyOneExpr().
			// It's used to see what variables contribute to an expression.
			if (logGets)
				gets.push([this.root, ...this.path, prop]);

			// If we're getting an object or array property, apply watch() to it recursively.
			if (result && typeof result === 'object') {
				let handler = this.extend(prop); // same root, one level deeper on the path.
				
				return new Proxy(result, handler);
			}

			return result;
		}
	}
	
	
	/**
	 * Called directly by JavaScript when setting the value of a property via equals.
	 * @param obj
	 * @param prop
	 * @param value
	 * @returns {boolean} */
	set(obj, prop, value) {
		withinSet++;

		let obj2 = obj === this.root && this.props ? this.props : obj;
		let result = Reflect.set(obj2, prop, value);
		let fullPath = [...this.path, prop+''];
		this.notify(fullPath);
		
		withinSet --;

		return result;
	}
	
	/**
	 * Find every subscriber for fullPath, and above, and call applyExprs() for it.
	 * @param fullPath {string[]}
	 * @param excluded {Set} */
	notify(fullPath, excluded = new Set()) {
		
		// Traverse upward through the path, looking for pathToTemplates.
		let ngm = NodeGroupManager.get(this.root);
		
		let rootHash = getObjectId(this.root);
	
		let len = fullPath.length;
		while (len >= 1) {
			let path = fullPath.slice(0, len);
			let val = delve(this.root, path);
			let serializedPath = JSON.stringify([rootHash, ...path]);
			for (let subscriber of ngm.subscribers.getAll(serializedPath)) {
				// We already applied expressions for a single item within this loop.
				if (excluded.has(subscriber))
					continue;
				
				
				// Delete child subscriptions so we don't have duplicate subscriptions when we call applyExprs() directly below.
				if (subscriber.children) {
					for (let [spath, childInfo] of subscriber.children)
						ngm.subscribers.delete(spath, childInfo);
					subscriber.children = undefined;
				}

				let proxyVal = getProxy(val, this, path);
				let exprs = subscriber.transformer(proxyVal).exprs; // TODO: Pass updated array as third argument to transformer.
				for (let path of subscriber.template.nodeGroup.paths)
					path.clearNodesCache();
				
				// Apply expressions.
				subscriber.template.nodeGroup.applyExprs(exprs);
				
				// Don't also process parent loop after updating a single item within it.
				if (subscriber.parent)
					excluded.add(subscriber.parent);
			}
			len--;
		}
	}
}

function getProxy(obj, ph, path, path2) {
	if (!obj || !typeof obj !== 'object')
		return obj;
	
	if (obj.$proxyHandler) {
		
		assert(obj.$proxyHandler.root === ph.root && JSON.stringify(obj.$proxyHandler.path) === JSON.stringify(path));
		return obj;
	}
	if (path2)
		path = [...path, path2+''];
	return new Proxy(obj, new ProxyHandler(ph.root, path, ph.props));
}

/**
 * Call a function and record which watched variables it accesess, storing their paths in pathToTemplates.
 * Used by NodeGroup.applyOneExpr().
 * TODO: only allow this to be called once per callback.
 * @param callback {function}
 * @param ngm {NodeGroupManager}
 * @returns {Template} */
function watchFunction(callback, ngm) {
	ngm.clearSubscribersIfNeeded();
	
	logGets = true;
	
	let transformer = () => new Template(['', ''], [callback()]);
	let template = transformer();
	for (let path of gets) {
		let subscriber = new Subscriber(transformer, template);
		ngm.subscribers.add(serializePath(path), subscriber);
	}

	gets = [];
	logGets = false;
	return template;
}

/**
 * Represents a place where nodes will be updated.
 * TODO: Merge this with Template, or ExprPath? */
class Subscriber {
	
	/** @type {Subscriber} Used only for children of a loop. */
	parent;
	
	/** @type {Subscriber[]} TemplateInfo for each child of a loop. */
	children;
	
	/**
	 * @param transformer {function} Function that turns the object at the path into a template.
	 * @param template {Template}
	 * @param itemTransformer {function} If a loop, this transforms each item in the loop. */
	constructor(transformer, template, itemTransformer=null) {
		this.transformer = transformer;
		this.template = template;
		
		// Used only for loops
		this.itemTransformer = itemTransformer;
	}
}

/** @typedef {boolean|string|number|function|Object|Array|Date|Node} Expr */

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

	/** @Type {NodeGroupManager} */
	manager;

	/** @type {ExprPath} */
	parentPath;

	/** @type {Node} First node of NodeGroup. Should never be null. */
	startNode;

	/** @type {Node} A node that never changes that this NodeGroup should always insert its nodes before.
	 * An empty text node will be created to insertBefore if there's no other NodeMarker and this isn't at the last position.*/
	endNode;

	/** @type {ExprPath[]} */
	paths = [];

	/** @type {string} */
	exactKey;

	/** @type {string} */
	closeKey;

	/** @type {boolean} Used by NodeGroupManager. */
	inUse;


	/**
	 * @internal
	 * @type {Node[]} Cached result of getNodes() used only for improving performance.*/
	nodesCache;

	/**
	 * @type {?Map<HTMLStyleElement, string>} */
	styles;

	/**
	 * If rendering a Template with replaceMode=true, pseudoRoot points to the element where the attributes are rendered.
	 * But pseudoRoot is outside of this.getNodes().
	 * NodeGroupManager.render() copies the attributes from pseudoRoot to the actual web component root element.
	 * @type {?HTMLElement} */
	pseudoRoot;

	currentComponentProps = {};
	

	/**
	 * Create an "instantiated" NodeGroup from a Template and add it to an element.
	 * @param template {Template}  Create it from the html strings and expressions in this template.
	 * @param manager {?NodeGroupManager}
	 * @returns {NodeGroup} */
	constructor(template, manager=null) {

		// Used for forEach()
		this.template = template;
		this.manager = manager;
		
		// new!
		template.nodeGroup = this;

		// Get a cached version of the parsed and instantiated html, and ExprPaths.
		let shell = Shell.get(template.html);

		let fragment = shell.fragment.cloneNode(true);

		// Figure out value of replaceMode option if it isn't set,
		// Assume replaceMode if there's only one child element and its tagname matches the root el.
		let replaceMode = typeof template.replaceMode === 'boolean'
			? template.replaceMode
			: fragment.children.length===1 &&
				fragment.firstElementChild?.tagName.replace(/-REDCOMPONENT-PLACEHOLDER$/, '')
				=== manager?.rootEl?.tagName;
		if (replaceMode) {
			this.pseudoRoot = fragment.firstElementChild;
			// if (!manager.rootEl)
			// 	manager.rootEl = this.pseudoRoot;
			
		}

		let childNodes = replaceMode
			? fragment.firstElementChild.childNodes
			: fragment.childNodes;


		this.startNode = childNodes[0];
		this.endNode = childNodes[childNodes.length - 1];


		// Update paths
		for (let oldPath of shell.paths) {
			let path = oldPath.clone(fragment);
			path.parentNg = this;
			this.paths.push(path);
		}
		

		// Update web component placeholders.
		// Ctrl+F "redcomponent-placeholder" in project to find all code that manages subcomponents.
		// Is this list needed at all?
		//for (let component of shell.components)
		//	this.components.push(resolveNodePath(this.startNode.parentNode, getNodePath(component)))

		

		this.activateEmbeds(fragment, shell);
		
		

		// Apply exprs
		this.applyExprs(template.exprs);

		
	}

	activateEmbeds(root, shell) {

		// static components
		// Must happen before ids.
		for (let path of shell.staticComponents) {
			let el = resolveNodePath(root, path);

			// Shell doesn't know if a web component is the pseudoRoot so we have to detect it here.
			if (el.tagName !== this.pseudoRoot?.tagName)
				this.createNewComponent(el);
		}

		if (this.manager.rootEl) {

			// ids
			if (this.manager.options.ids !== false)
				for (let path of shell.ids) {
					let el = resolveNodePath(root, path);
					let id = el.getAttribute('data-id') || el.getAttribute('id');
					this.manager.rootEl[id] = el;
				}

			// styles
			if (this.manager.options.styles !== false) {
				if (shell.styles.length)
					this.styles = new Map();
				for (let path of shell.styles) {
					let style = resolveNodePath(root, path);
					Util.bindStyles(style, this.manager.rootEl);
					this.styles.set(style, style.textContent);
				}

			}
			// scripts
			if (this.manager.options.scripts !== false) {
				for (let path of shell.scripts) {
					let script = resolveNodePath(root, path);
					eval(script.textContent);
				}
			}
		}
	}

	updateStyles() {
		if (this.styles)
			for (let [style, oldText] of this.styles) {
				let newText = style.textContent;
				if (oldText !== newText)
					Util.bindStyles(style, this.manager.rootEl);
			}
	}

	/**
	 * Use the paths to insert the given expressions.
	 * Dispatches expression handling to other functions depending on the path type.
	 * @param exprs {(*|*[]|function|Template)[]} */
	applyExprs(exprs) {
		
		
		// Update exprs at paths.
		let exprIndex = exprs.length-1, expr, lastNode;

		// We apply them in reverse order so that a <select> box has its options created from an expression
		// before its value attribute is set via an expression.
		for (let path of this.paths.toReversed()) {
			expr = exprs[exprIndex];

			// Nodes
			if (path.type === PathType.Content) {
				this.applyNodeExpr(path, expr);
				
			}

			// Attributes
			else {
				let node = path.nodeMarker; // path.resolve(result);
				let node2 = (this.manager.rootEl && node === this.pseudoRoot) ? this.manager.rootEl : node;
				

				// This is necessary both here and below.
				if (lastNode && lastNode !== this.pseudoRoot && lastNode !== node && Object.keys(this.currentComponentProps).length) {
					this.applyComponentExprs(lastNode, this.currentComponentProps);
					this.currentComponentProps = {};
				}

				if (path.type === PathType.Multiple)
					path.applyMultipleAttribs(node2, expr);

				// Capture attribute expressions to later send to the constructor of a web component.
				// Ctrl+F "redcomponent-placeholder" in project to find all code that manages subcomponents.
				else if (path.nodeMarker !== this.pseudoRoot && path.type === PathType.Component)
					this.currentComponentProps[path.attrName] = expr;
				
				else if (path.type === PathType.Comment) ;
				else {

					// Event attribute value
					if (path.attrValue===null && (typeof expr === 'function' || Array.isArray(expr)) && isEvent(path.attrName)) {
						let root = this.manager.rootEl || this.startNode.parentNode;  // latter is used when constructing a whole element.
						path.applyEventAttrib(node2, expr, root);
					}

					// Regular attribute value.
					else
						exprIndex = path.applyValueAttrib(node2, exprs, exprIndex);
				}

				lastNode = path.nodeMarker;
			}

			exprIndex--;
		} // end for(path of this.paths)


		// Check again after we iterate through all paths to apply to a component.
		if (lastNode && lastNode !== this.pseudoRoot && Object.keys(this.currentComponentProps).length) {
			this.applyComponentExprs(lastNode, this.currentComponentProps);
			this.currentComponentProps = {};
		}

		this.updateStyles();

		// Invalidate the nodes cache because we just changed it.
		this.nodesCache = null;

		// If there's leftover expressions, there's probably an issue with the Shell that created this NodeGroup,
		// and the number of paths not matching.
		


		
	}

	/**
	 * Insert/replace the nodes created by a single expression.
	 * Called by applyExprs()
	 * This function is recursive, as the functions it calls also call it.
	 * TODO: Move this to ExprPath?
	 * @param path {ExprPath}
	 * @param expr {Expr}
	 * @return {Node[]} New Nodes created. */
	applyNodeExpr(path, expr) {
		

		/** @type {(Node|NodeGroup|Expr)[]} */
		let newNodes = [];
		let oldNodeGroups = path.nodeGroups;
		
		let secondPass = []; // indices

		// First Pass
		//for (let ng of path.nodeGroups) // TODO: Is this necessary?
		//	ng.parentPath = null;
		path.nodeGroups = [];
		this.applyOneExpr(expr, path, newNodes, secondPass);
		this.existingTextNodes = null;

		// TODO: Create an array of old vs Nodes and NodeGroups together.
		// If they're all the same, skip the next steps.
		// Or calculate it in the loop above as we go?  Have a path.lastNodeGroups property?

		// Second pass to find close-match NodeGroups.
		let flatten = false;
		if (secondPass.length) {
			for (let [nodesIndex, ngIndex] of secondPass) {
				let ng = this.manager.getNodeGroup(newNodes[nodesIndex], false);
				
				ng.parentPath = path;
				let ngNodes = ng.getNodes();

				
				
				if (ngNodes.length === 1)
					newNodes[nodesIndex] = ngNodes[0];
				
				else {
					newNodes[nodesIndex] = ngNodes;
					flatten = true;
				}
				path.nodeGroups[ngIndex] = ng;
			}

			if (flatten)
				newNodes = newNodes.flat(); // TODO: Only if second pass happens?
		}

		


	
		let oldNodes = path.getNodes();
		path.nodesCache = newNodes; // Replaces value set by path.getNodes()


		// This pre-check makes it a few percent faster?
		let diff = findArrayDiff(oldNodes, newNodes);
		if (diff !== false) {

			if (this.parentPath)
				this.parentPath.clearNodesCache();

			// Fast clear method
			let isNowEmpty = oldNodes.length && !newNodes.length;
			if (!isNowEmpty || !path.fastClear(oldNodes, newNodes))

				// Rearrange nodes.
				udomdiff(path.parentNode, oldNodes, newNodes, path.nodeMarker);

			this.saveOrphans(oldNodeGroups, oldNodes);
		}
		
	}
	
	/**
	 * Find NodeGroups that had their nodes removed and add those nodes to a Fragment so
	 * they're not lost forever and the NodeGroup's internal structure is still consistent.
	 * Called from NodeGroup.applyNodeExpr().
	 * @param oldNodeGroups {NodeGroup[]}
	 * @param oldNodes {Node[]} */
	saveOrphans(oldNodeGroups, oldNodes) {
		let oldNgMap = new Map();
		for (let ng of oldNodeGroups) {
			oldNgMap.set(ng.startNode, ng);
			
			// TODO: Is this necessary?
			// if (ng.parentPath)
			// 	ng.parentPath.clearNodesCache();
		}

		for (let i=0, node; node = oldNodes[i]; i++) {
			let ng;
			if (!node.parentNode && (ng = oldNgMap.get(node))) {
				let fragment = document.createDocumentFragment();
				let endNode = ng.endNode;
				while (node !== endNode) {
					fragment.append(node);
					i++;
					node = oldNodes[i];
				}
				fragment.append(endNode);
			}
		}
	}

	// TODO: Move to ExprPath?
	applyOneExpr(expr, path, newNodes, secondPass) {
		
		if (expr instanceof Template) {
			expr.parentPath = path;
			expr.nodegroup = this;
			
			//if (window.debug && expr.exprs[0] === 'Banana' && path.nodeGroups.length === 0)
			//if (window.debug && expr.exprs[0] === 'Banana')
			//	debugger;
			
			let ng = this.manager.getNodeGroup(expr, true);
			
			
			if (ng) {
				
				
				
				// TODO: Track ranges of changed nodes and only pass those to udomdiff?
				// But will that break the swap benchmark?
				newNodes.push(...ng.getNodes());
				path.nodeGroups.push(ng);
			}
			
			// If expression, evaluate later to find partial match.
			else {
				secondPass.push([newNodes.length, path.nodeGroups.length]);
				newNodes.push(expr);
				path.nodeGroups.push(null); // placeholder
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

		else if (Array.isArray(expr))
			for (let subExpr of expr)
				this.applyOneExpr(subExpr, path, newNodes, secondPass);

		else if (typeof expr === 'function') {
			expr = watchFunction(expr, this.manager);
			
			this.applyOneExpr(expr, path, newNodes, secondPass);
		}

		// Text
		else {
			// Convert falsy values (but not 0) to empty string.
			// Convert numbers to string so they compare the same.
			let text = (expr === undefined || expr === false || expr === null) ? '' : expr + '';

			// Fast path for updating the text of a single text node.
			let first = path.nodeBefore.nextSibling;
			if (first.nodeType === 3 && first.nextSibling === path.nodeMarker && !newNodes.includes(first)) {
				if (first.textContent !== text)
					first.textContent = text;
				
				newNodes.push(first);
			}

			else {
				// TODO: Optimize this into a Set or Map or something?
				if (!this.existingTextNodes)
					this.existingTextNodes = path.getNodes().filter(n => n.nodeType === 3);
				
				let idx = this.existingTextNodes.findIndex(n => n.textContent === text);
				if (idx !== -1)
					newNodes.push(...this.existingTextNodes.splice(idx, 1));
				else
					newNodes.push(path.parentNode.ownerDocument.createTextNode(text));
			}
		}
	}

	/**
	 * Create a nested RedComponent or call render with the new props.
	 * @param el {Solarite:HTMLElement}
	 * @param props {Object} */
	applyComponentExprs(el, props) {
		
		// TODO: Does a hash of this already exist somewhere?
		// Perhaps if Components were treated as child NodeGroups, which would need to be the child of an ExprPath,
		// then we could re-use the hash and logic from NodeManager?
		let newHash = getObjectHash(props);
		
		let isPreHtmlElement = el.tagName.endsWith('-REDCOMPONENT-PLACEHOLDER');
		let isPreIsElement = el.hasAttribute('_is');
		
		
		// Instantiate a placeholder.
		if (isPreHtmlElement || isPreIsElement)
			el = this.createNewComponent(el, isPreHtmlElement, props);
		
		// Update params of placeholder.
		else if (el.render) {
			let oldHash = componentHash.get(el);
			if (oldHash !== newHash)
				el.render(props); // Pass new values of props to render so it can decide how it wants to respond.
		}
		
		componentHash.set(el, newHash);
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
			? el.tagName.endsWith('-REDCOMPONENT-PLACEHOLDER')
				? el.tagName.slice(0, -25)
				: el.tagName
			: el.getAttribute('is')).toLowerCase();

		let dynamicProps = {...(props || {})};
		
		// Pass other attribs to constructor, since otherwise they're not yet set on the element,
		// and the constructor would otherwise have no way to see them.
		if (el.attributes.length) {
			if (!props)
				props = {};
			for (let attrib of el.attributes)
				if (!props.hasOwnProperty(attrib.name))
					props[attrib.name] = attrib.value;
		}
		
		// Create CustomElement and
		let Constructor = customElements.get(tagName);
		if (!Constructor)
			throw new Error(`The custom tag name ${tagName} is not registered.`)

		// We pass the childNodes to the constructor so it can know about them,
		// instead of only afterward when they're appended to the slot below.
		// This is useful for a custom selectbox, for example.
		// NodeGroupManager.pendingChildren stores the childen so the super construtor call to Solarite's constructor
		// can add them as children before the rest of the constructor code executes.
		let ch = [... el.childNodes];
		NodeGroupManager.pendingChildren.push(ch);  // pop() is called in Solarite constructor.
		let newEl = new Constructor(props, ch);

		if (!isPreHtmlElement)
			newEl.setAttribute('is', el.getAttribute('is').toLowerCase());
		el.replaceWith(newEl);
		
		// Set children / slot children
		// TODO: Match named slots.
		// TODO: This only appends to slot if render() is called in the constructor.
		//let slot = newEl.querySelector('slot') || newEl;
		//slot.append(...el.childNodes);
		
		// Copy over event attributes.
		for (let propName in props) {
			let val = props[propName];
			if (propName.startsWith('on') && typeof val === 'function')
				newEl.addEventListener(propName.slice(2), e => val(e, newEl));
		}
		
		// If an id pointed at the placeholder, update it to point to the new element.
		let id = el.getAttribute('data-id') || el.getAttribute('id');
		if (id)
			this.manager.rootEl[id] = newEl;
		
		
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
		for (let name in dynamicProps) {
			let val = dynamicProps[name];
			if (typeof val === 'boolean') {
				if (val !== false && val !== undefined && val !== null)
					newEl.setAttribute(name, '');
			}

			// If type isn't an object or array, set the attribute.
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


	
}


let componentHash = new WeakMap();

/**
 * @typedef {Object} RenderOptions
 * @property {boolean=} styles - Indicates whether the Courage component is present.
 * @property {boolean=} scripts - Indicates whether the Power component is present.
 * @property {boolean=} ids
 *
 * @property {?boolean} render
 * 	   Used only when options are given to a class super constructor inheriting from Solarite.
 *     True to call render() immediately in super constructor.
 *     False to automatically call render() at all.
 *     Undefined (default) to call render() when added to the DOM, unless already rendered.
 */


/**
 * Manage all the NodeGroups for a single WebComponent or root HTMLElement
 * There's one NodeGroup for the root of the WebComponent, and one for every ${...} expression that creates Node children.
 * And each NodeGroup manages the one or more nodes created by the expression.
 *
 * An instance of this class exists for each element that r() renders to. */
class NodeGroupManager {

	/** @type {HTMLElement|DocumentFragment} */
	rootEl;

	/** @type {NodeGroup} */
	rootNg;
	
	/** @type {Change[]} */
	changes = [];
	
	

	

	/**
	 * A map from the html strings and exprs that created a node group, to the NodeGroup.
	 * Also stores a map from just the html strings to the NodeGroup, so we can still find a similar match if the exprs changed.
	 *
	 * @type {MultiValueMap<string, (string|Template)[], NodeGroup>} */
	nodeGroupsAvailable = new MultiValueMap();
	nodeGroupsInUse = [];


	/** @type {RenderOptions} */
	options = {};

	
	

	/**
	 * @param rootEl {HTMLElement|DocumentFragment} If not specified, the first element of the html will be the rootEl. */
	constructor(rootEl=null) {
		this.rootEl = rootEl;
		/*
		
		*/
	}

	/**
	 * Render the main template, which may indirectly call renderTemplate() to create children.
	 * @param template {Template}
	 * @param options {RenderOptions}
	 * @return {?DocumentFragment} */
	render(template, options={}) {
		this.mutationWatcherEnabled = false;
		this.options = options;
		this.clearSubscribers = false;
		
		
		
		if (!template && template !== '') {
			this.rootEl.outerHTML = '';
			this.mutationWatcherEnabled = true;
			return null;
		}
		
		// Fast path for empty component.
		if (template.html?.length === 1 && !template.html[0]) {
			this.rootEl.innerHTML = '';
		}
		else {

			// Find or create a NodeGroup for the template.
			// This updates all nodes from the template.
			let close;
			let exact = this.getNodeGroup(template, true);
			if (!exact) {
				close = this.getNodeGroup(template, false);
			}
			
			
			let firstTime = !this.rootNg;
			this.rootNg = exact || close;

			// Reparent NodeGroup
			// TODO: Move this to NodeGroup?
			let parent = this.rootNg.getParentNode();
			if (!this.rootEl)
				this.rootEl = parent;

			// If this is the first time rendering this element.
			else if (firstTime) {

				// Save slot children
				let fragment;
				if (this.rootEl.childNodes.length) {
					fragment = document.createDocumentFragment();
					fragment.append(...this.rootEl.childNodes);
				}

				// Add rendered elements.
				if (parent instanceof DocumentFragment)
					this.rootEl.append(parent);
				else if (parent)
					this.rootEl.append(...parent.childNodes);

				// Apply slot children
				if (fragment) {
					for (let slot of this.rootEl.querySelectorAll('slot[name]')) {
						let name = slot.getAttribute('name');
						if (name)
							slot.append(...fragment.querySelectorAll(`[slot='${name}']`));
					}
					let unamedSlot = this.rootEl.querySelector('slot:not([name])');
					if (unamedSlot)
						unamedSlot.append(fragment);
				}

			}

			// this.rootNg was rendered as childrenOnly=true
			// Apply attributes from a root element to the real root element.
			let ng = this.rootNg;
			if (ng.pseudoRoot && ng.pseudoRoot !== this.rootEl) {
				

				// Remove old attributes
				// for (let attrib of this.rootEl.attributes)
				// 	if (attrib.name !== 'is' && attrib.name !== 'data-style' && !ng.pseudoRoot.hasAttribute(attrib.name))
				// 		this.rootEl.removeAttribute(attrib.name)

				// Add/set new attributes
				if (firstTime)
                    for (let attrib of ng.pseudoRoot.attributes)
                        if (!this.rootEl.hasAttribute(attrib.name))
                            this.rootEl.setAttribute(attrib.name, attrib.value);

				// ng.startNode = ng.endNode = this.rootEl;
				// ng.nodesCache = [ng.startNode]
				// for (let path of ng.paths) {
				// 	if (path.nodeMarker === ng.rootEl)
				// 		path.nodeMarker = this.rootEl;
				// 	path.nodesCache = null;
				// 	
				// }
				//
				// ng.rootEl = this.rootEl;
			}

			
			this.reset();
			
		}

		this.mutationWatcherEnabled = true;
		return this.rootEl;
		
	}


	/**
	 *
	 * 1.  Delete a NodeGroup from this.nodeGroupsAvailable that matches this exactKey.
	 * 2.  Then delete all of that NodeGroup's parents' exactKey entries
	 *     We don't move them to in-use because we plucked the NodeGroup from them, they no longer match their exactKeys.
	 * 3.  Then we move all the NodeGroup's exact+close keyed children to inUse because we don't want future calls
	 *     to getNodeGroup() to borrow the children now that the whole NodeGroup is in-use.
	 *
	 * TODO: Have NodeGroups keep track of whether they're inUse.
	 * That way when we go up or down we don't have to remove those with .inUse===true
	 *
	 * @param exactKey
	 * @param goUp
	 * @param child
	 * @returns {?NodeGroup} */
	findAndDeleteExact(exactKey, goUp=true, child=undefined) {

		let ng = this.nodeGroupsAvailable.delete(exactKey, child);
		if (ng) {
			
			
			// Mark close-key version as in-use.
			let closeNg = this.nodeGroupsAvailable.delete(ng.closeKey, ng);
			

			// Mark our self as in-use.
			this.nodeGroupsInUse.push(ng);

			ng.inUse = true;
			closeNg.inUse = true;

			// Mark all parents that have this NodeGroup as a child as in-use.
			// So that way we don't use this parent again
			if (goUp) {
				let ng2 = ng;
				while (ng2 = ng2?.parentPath?.parentNg) {
					if (!ng2.inUse) {
						ng2.inUse = true;
						let success = this.nodeGroupsAvailable.delete(ng2.exactKey, ng2);
						// assert(success);
						let success2 = this.nodeGroupsAvailable.delete(ng2.closeKey, ng2);
						// assert(success);
						

						// console.log(getHtml(ng2))
						if (success) {
							this.nodeGroupsInUse.push(ng2);
						}
					}
				}
			}

			// Recurse to mark all child NodeGroups as in-use.
			for (let path of ng.paths)
				for (let childNg of path.nodeGroups) {
					if (!childNg.inUse)
						this.findAndDeleteExact(childNg.exactKey, false, childNg);
					childNg.inUse = true;
				}
			
			if (ng.parentPath) ;

			return ng;
		}
		return null;
	}
	
	/**
	 * @param closeKey {string}
	 * @param exactKey {string}
	 * @param goUp {boolean}
	 * @returns {NodeGroup} */
	findAndDeleteClose(closeKey, exactKey, goUp=true) {
		let ng = this.nodeGroupsAvailable.delete(closeKey);
		if (ng) {
			
			// We matched on a new key, so delete the old exactKey.
			let exactNg = this.nodeGroupsAvailable.delete(ng.exactKey, ng);
			
			
			
			
			
			ng.inUse = true;
			if (goUp) {
				let ng2 = ng;

				// We borrowed a node from another node group so make sure its parent isn't still an exact match.
				while (ng2 = ng2?.parentPath?.parentNg) {
					if (!ng2.inUse) {
						ng2.inUse = true; // Might speed it up slightly?
						let success = this.nodeGroupsAvailable.delete(ng2.exactKey, ng2);
						

						// But it can still be a close match, so we don't use this code.
						success = this.nodeGroupsAvailable.delete(ng2.closeKey, ng2);
						
					}
				}
			}

			// Recursively mark all child NodeGroups as in-use.
			// We actually DON't want to do this becuse applyExprs is going to swap out the child NodeGroups
			// and mark them as in-use as it goes.
			// that's probably why uncommenting this causes tests to fail.
			// for (let path of ng.paths)
			// 	for (let childNg of path.nodeGroups)
			// 		this.findAndDeleteExact(childNg.exactKey, false, childNg);


			ng.exactKey = exactKey;
			ng.closeKey = closeKey;
			this.nodeGroupsInUse.push(ng);
			
			
			if (ng.parentPath) ;
		}
		
		
		return ng;
	}

	/**
	 * Get an existing or create a new NodeGroup that matches the template,
	 * but don't reparent it if it's somewhere else.
	 * @param template {Template}
	 * @param exact {?boolean}
	 * @param createForWatch
	 * @return {?NodeGroup} */
	getNodeGroup(template, exact=null, createForWatch=false) {

		let exactKey = getObjectHash(template);

		// 1. Try to find an exact match.
		let ng;
		if (exact === true) {
			ng = this.findAndDeleteExact(exactKey);

			if (!ng) {
				
				return null;
			}
		}

		// 2.  Try to find a close match.
		else {
			// We don't need to delete the exact match bc it's already been deleted in the prev pass.
			let closeKey = template.getCloseKey();
			ng = createForWatch ? null : this.findAndDeleteClose(closeKey, exactKey);

			// 2. Update expression values if they've changed.
			if (ng) {
				
				// Temporary for debugging:
				if (window.debug && !window.ng)
					window.ng = ng;
				
				
				ng.applyExprs(template.exprs);

				
				
			}

			// 3. Or if not found, create a new NodeGroup
			else {
				
				ng = new NodeGroup(template, this);
				

				


				// 4. Mark NodeGroup as being in-use.
				// TODO: Moving from one group to another thrashes the gc.  Is there a faster way?
				// Could I have just a single WeakSet of those in use?
				// Perhaps also result could cache its last exprKey and then we'd use only one map?
				ng.exactKey = exactKey;
				ng.closeKey = closeKey;
				if (createForWatch) // TODO: Have this path be a separate function?
					this.nodeGroupsAvailable.add(ng.exactKey, ng);
				else
					this.nodeGroupsInUse.push(ng);
			}
		}
		
		// New!
		// We clear the parent PathExpr's nodesCache when we remove ourselves from it.
		// Benchmarking shows this doesn't slow down the partialUpdate benchmark.
		if (ng.parentPath) {
			// ng.parentPath.clearNodesCache(); // Makes partialUpdate benchmark 10x slower!
		 	ng.parentPath = null;
		}


		
		
		return ng;
	}

	reset() {
		//this.changes = [];
		let available = this.nodeGroupsAvailable;
		for (let ng of this.nodeGroupsInUse) {
			ng.inUse = false;
			available.add(ng.exactKey, ng);
			available.add(ng.closeKey, ng);
		}
		this.nodeGroupsInUse = [];

		// Used for watches
		this.changes = [];

		
		// TODO: free the memory from any nodeGroupsAvailable() after render is done, since they weren't used?
	}


	// deprecated
	//pathToLoopInfo = new MultiValueMap(); // uses a Set() for each value.
	clearSubscribers = false;

	/**
	 * One path may be used to loop in more than one place, so we use this to get every anchor from each loop.
	 * @param path {Array}
	 * @return {LoopInfo[]} A function that gets the loop anchor NodeGroup */
	getLoopInfo(path) {
		let serializedArrayPath = serializePath(path);
		return [...this.pathToLoopInfo.getAll(serializedArrayPath)]; // This is set inside forEach()
	}

	
	/**
	 * @deprecated
	 * Store the functions used to create items for each loop.
	 * TODO: Can this be combined with pathToTemplates?
	 * @type {MultiValueMap<string, Subscriber>} */
	pathToLoopInfo = new MultiValueMap();
	
	/**
	 * Maps variable paths to the templates used to create NodeGroups
	 * @type {MultiValueMap<string, Subscriber>} */
	subscribers = new MultiValueMap();
	
	clearSubscribersIfNeeded() {
		if (this.clearSubscribers) {
			this.pathToLoopInfo = new MultiValueMap();
			this.subscribers = new MultiValueMap();
			this.clearSubscribers = false;
		}
	}
	

	/**
	 * Get the NodeGroupManager for a Web Component.
	 * @param rootEl {Solarite|HTMLElement}
	 * @return {NodeGroupManager} */
	static get(rootEl) {
		let ngm = nodeGroupManagers.get(rootEl);
		if (!ngm) {
			ngm = new NodeGroupManager(rootEl);
			nodeGroupManagers.set(rootEl, ngm);
		}

		return ngm;
	}


	
}

NodeGroupManager.pendingChildren = [];

/**
 * Each Element that has Expr children has an associated NodeGroupManager here.
 * @type {WeakMap<HTMLElement, NodeGroupManager>} */
let nodeGroupManagers = new WeakMap();



class LoopInfo {
	constructor(loopTemplate, itemTransformer) {
		this.template = loopTemplate;
		this.itemTransformer = itemTransformer;
	}
}

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
 * 1. r`<b>Hello${'World'}!`           // Create Template that can later be used to create nodes.
 *
 * 2. r(el, template, ?options)        // Render the template created by #1 to element.
 * 3. r(el, options)`<b>${'Hi'}</b>`   // Create template and render its nodes to el.
 *
 * 4. r('Hello');                      // Create single text node.
 * 5. r('<b>Hello</b>');               // Create single HTMLElement
 * 6. r('<b>Hello</b><u>Goodbye</u>'); // Create document fragment because there's more than one node.
 * 7. r()`Hello<b>${'World'}!</b>`     // Same as 4-6, but evaluates the string as a Solarite template, which includes properly handling nested components and r`` sub-expressions.
 * 8. r(template)                      // Render Template created by #1.
 * 9. r(() => r`<b>Hello</b>`);        // Create dynamic element that has a render() function.
 *
 * @param htmlStrings {?HTMLElement|string|string[]|function():Template}
 * @param exprs {*[]|string|Template}
 * @return {Node|HTMLElement|Template} */
function r(htmlStrings=undefined, ...exprs) {

    // 1. Path if used as a template tag.
    if (Array.isArray(htmlStrings)) {
        return new Template(htmlStrings, exprs);
    }

    else if (htmlStrings instanceof Node) {
        let parent = htmlStrings, template = exprs[0];

        // 2. Render template created by #4 to element.
        if (exprs[0] instanceof Template) {
            let ngm = NodeGroupManager.get(parent);
            let options = exprs[1];
            ngm.render(template, options);

            // Append on the first go.
            if (!parent.childNodes.length && this) {
                // TODO: Is htis ever executed?
                debugger;
                parent.append(this.rootNg.getParentNode());
            }
        }

        // 3
        else if (!exprs.length || exprs[0]) {
            if (parent.shadowRoot)
                parent.innerHTML = ''; // Remove shadowroot.  TODO: This could mess up paths?

            let options = exprs[0];
            return (htmlStrings, ...exprs) => {
                rendered.add(parent);
                let template = r(htmlStrings, ...exprs);
                let ngm = NodeGroupManager.get(parent);
                return ngm.render(template, options);
            }
        }

        // null for expr[0], remove whole element.
        else {
            let ngm = NodeGroupManager.get(parent);
            ngm.render(null, exprs[1]);
        }
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
        if (templateEl.content.childNodes.length === 1)
            return templateEl.content.firstChild;

        // 6. Otherwise return DocumentFragment.
        return templateEl.content;
    }

    // 7. Create a static element
    else if (htmlStrings === undefined) {
        return (htmlStrings, ...exprs) => {
            //rendered.add(parent)
            let template = r(htmlStrings, ...exprs);
            return template.toNode();
        }
    }

    // 8.
    else if (htmlStrings instanceof Template) {
        let ngm = new NodeGroupManager();
        return ngm.render(htmlStrings);
    }

    // 9. Create dynamic element with render() function.
    else if (typeof htmlStrings === 'function') {
        let getTemplate = htmlStrings;
        let template = getTemplate();

        if (typeof template === 'string')
            throw new Error(`Please add the "r" prefix before the string "${template}"`)

        let ngm = new NodeGroupManager();
        template.replaceMode = true;
        let el = ngm.render(template);

        el.render = (function() {
            template = getTemplate();
            ngm.render(template);
        }).bind(el);

        return el;
    }
    else
        throw new Error('Unsupported arguments.')
}






/**
 * Elements that have been rendered to by r() at least once.
 * @type {WeakSet<HTMLElement>} */
let rendered = new WeakSet();

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
 * @type {Object<string, Class<Node>>} A map from built-in tag names to the constructors that create them. */
let elementClasses = {};

/**
 * Store which instances of Solarite have already been added to the DOM. * @type {WeakSet<HTMLElement>}
 */
let connected = new WeakSet();

/**
 * Create a version of the Solarite class that extends from the given tag name.
 * Reasons to inherit from this instead of HTMLElement.  None of these are all that useful.
 * 1.  customElements.define() is called automatically when you create the first instance.
 * 2.  Calls render() when added to the DOM, if it hasn't been called already.
 * 3.  Child elements are added before constructor is called.  But they're also passed to the constructor.
 * 4.  We can use this.html = r`...` to set html.
 * 5.  We have the onConnect, onFirstConnect, and onDisconnect methods.  These could be standalone though.
 * 6.  Can we extend from other element types like TR?
 *
 * @param extendsTag {?string}
 * @return {Class} */
function createSolarite(extendsTag=null) {

	let BaseClass = HTMLElement;
	if (extendsTag && !extendsTag.includes('-')) {
		extendsTag = extendsTag.toLowerCase();

		BaseClass = elementClasses[extendsTag];
		if (!BaseClass) { // TODO: Use Cache
			BaseClass = document.createElement(extendsTag).constructor;
			elementClasses[extendsTag] = BaseClass;
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
				rendered.add(this); // Don't render on connectedCallback()

			// Add children before constructor code executes.
			// PendingChildren is setup in NodeGroup.createNewComponent()
			// TODO: Match named slots.
			let ch = NodeGroupManager.pendingChildren.pop();
			if (ch)
				(this.querySelector('slot') || this).append(...ch);


			Object.defineProperty(this, 'html', {
				set(html) {
					rendered.add(this);
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
			if (!rendered.has(this) && this.render)
				this.render();
		}
		
		/**
		 * Called automatically by the browser. */
		connectedCallback() {
			this.renderFirstTime();
			if (!connected.has(this)) {
				connected.add(this);
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


		renderWatched() {
			let ngm = NodeGroupManager.get(this);

			let nodeGroupUpdates = [];

			for (let change of ngm.changes) {
				if (change.action === 'set') {
					for (let transformerInfo of change.transformerInfo) {

						let oldHash = transformerInfo.hash;

						let newObj = delve(watchSet(transformerInfo.path[0]), transformerInfo.path.slice(1));
						let newTemplate = transformerInfo.transformer(newObj);
						let newHash = getObjectHash(newTemplate);
						let ngs = [...ngm.nodeGroupsAvailable.data[oldHash]];
						for (let ng of ngs) {
							nodeGroupUpdates.push([ng, oldHash, newHash, newTemplate.exprs, transformerInfo]);
						}
					}
				}

				else if (change.action === 'delete') {
					for (let hash of change.value) {
						let ngs = [...ngm.nodeGroupsAvailable.getAll(hash)]; // deletes from nodeGroupsAvailable.

						for (let ng of ngs) {
							if (ng.parentPath)
								ng.parentPath.clearNodesCache();

							for (let node of ng.getNodes())
								node.remove();

							// TODO: Update ancestor NodeGroup exactKeys
						}
					}
				}
				else if (change.action === 'insert') {

					let beforeNg = change.beforeTemplate ? ngm.getNodeGroup(change.beforeTemplate, true) : null;
					let arrayPath = [change.root, ...change.path];

					// Get anchor so we can use it to get the parent
					// TODO: Should this be watchGet(change.root) ?
					for (let loopInfo of ngm.getLoopInfo([change.root, ...change.path.slice(0, -1)])) {

						// Change.extra is aTemplate telling us where to insert before.
						let beforeNode = beforeNg?.startNode || loopInfo.template.parentPath.nodeMarker;

						// Loop over every item added to the array.
						let i = 0; // TODO: How to get real insert index.
						for (let obj of change.value) {

							// Same logic as forEach() function.

							let callback = loopInfo.itemTransformer;
							let path = [...arrayPath.slice(0, -1), (arrayPath.at(-1) * 1 + i) + ''];

							// Shortened logic found in watchGet(), but not any faster?
							// the watchSet() is what makes this slower!
							// let obj = delve(watchSet(path[0]), path.slice(1));
							// let template = callback(obj);
							// let serializedPath = serializePath(path);
							// pathToTransformer.add(serializedPath, new TransformerInfo(path, callback, template)); // Uses a Set() to ensure no duplicates.

							let template = watchGet(path, callback);
							i++;


							//let template = loopInfo.itemTransformer(obj); // What if it takes more than one obj argument?

							// Create new NodeGroup
							let ng = ngm.getNodeGroup(template, false, true);
							ng.parentPath = beforeNg?.parentPath || loopInfo.template.parentPath;
							
							for (let node of ng.getNodes())
								beforeNode.parentNode.insertBefore(node, beforeNode);

							if (ng.parentPath) // This check is needed for the forEachSpliceInsert test, but why?
								ng.parentPath.clearNodesCache();
						}

						// TODO: Update ancestor NodeGroup exactKeys
					}
				}
			}

			// Update them all at once, that way we can reassign the same value twice.
			for (let [ng, oldHash, newHash, exprs, ti] of nodeGroupUpdates) {
				ng.applyExprs(exprs);
				ngm.nodeGroupsAvailable.data[oldHash].delete(ng);
				ng.exactKey = ti.hash = newHash;
				ngm.nodeGroupsAvailable.add(ng.exactKey, ng); // Add back to Map with new key.
			}


			ngm.changes = [];

			return []; // TODO
		}
		
		/**
		 * @deprecated Use the getArg() function instead. */
		getArg(name, val=null, type=ArgType.String) {
			return getArg(this, name, val, type);
		}
	}
}

/**
 * TODO: The Proxy and the multiple base classes mess up 'instanceof Solarite'
 * @type {Node|Class<HTMLElement>|function(tagName:string):Node|Class<HTMLElement>} */
let Solarite = new Proxy(createSolarite(), {
	apply(self, _, args) {
		return createSolarite(...args)
	}
});
 // unfinished

export { ArgType, Solarite, forEach, getArg, r, watch, watchGet, watchSet };
