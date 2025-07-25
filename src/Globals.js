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

		/**
		 * ExprPath.applyExactNodes() sets this property when an expression is being accessed.
		 * watch() then adds the ExprPath to the list of ExprPaths that should be re-rendered when the value changes.
		 * @type {ExprPath}*/
		currentExprPath: null,

		div: document.createElement("div"),

		/**
		 * @type {Record<string, Class<Node>>} A map from built-in tag names to the constructors that create them. */
		elementClasses: {},

		/** @type {Record<string, boolean>} Key is tag-name.propName.  Value is whether it's an attribute.*/
		htmlProps: {},

		/**
		 * Used by ExprPath.applyEventAttrib()
		 * @type {WeakMap<Node, Record<eventName:string, [original:function, bound:function, args:*[]]>>} */
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
		 * Elements that have been rendered to by r() at least once.
		 * This is used by the Solarite class to know when to call onFirstConnect()
		 * @type {WeakSet<HTMLElement>} */
		rendered: new WeakSet(),

		/**
		 * Elements that are currently rendering via the r() function.
		 * @type {WeakSet<HTMLElement>} */
		rendering: new WeakSet(),

		/**
		 * Map from array of Html strings to a Shell created from them.
		 * @type {WeakMap<string[], Shell>} */
		shells: new WeakMap(),

		/**
		 * A map of individual untagged strings to their Templates.
		 * This way we don't keep creating new Templates for the same string when re-rendering.
		 * This is used by ExprPath.applyExactNodes()
		 * @type {Record<string, Template>} */
		//stringTemplates: {},

		reset,

		count: 0
	};
}
reset();

export default Globals;