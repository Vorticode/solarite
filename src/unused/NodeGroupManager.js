import MultiValueMap from "./MultiValueMap.js";
import NodeGroup from "./NodeGroup.js";
import {getObjectHash} from "./hash.js";

import {assert} from "../util/Errors.js";
import Globals from "./Globals.js";
import Template from "./Template.js";



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
	
	

	//#IFDEV
	modifications;
	logDepth=0
	//#ENDIF

	/**
	 * A map from the html strings and exprs that created a node group, to the NodeGroup.
	 * Also stores a map from just the html strings to the NodeGroup, so we can still find a similar match if the exprs changed.
	 * @type {MultiValueMap<string, (string|Template)[], NodeGroup>} */
	nodeGroupsAvailable = new MultiValueMap();

	/**
	 * Save the NodeGroups that are returned by NodeGroupManager.get()
	 * Calling reset() at the end of render puts them all back into nodeGroupsAvailable.
	 * @type {NodeGroup[]} */
	nodeGroupsInUse = [];


	/** @type {RenderOptions} TODO: Where is this ever used? */
	options = {};

	
	//#IFDEV
	mutationWatcher;
	mutationWatcherEnabled = true;
	//#ENDIF

	/**
	 * @param rootEl {HTMLElement|DocumentFragment} If not specified, the first element of the html will be the rootEl. */
	constructor(rootEl=null) {
		this.rootEl = rootEl;
		this.resetModifications();

		/*
		//#IFDEV

		// Use MutationWatcher to check for illegal DOM modifications.
		function closestCustomElement(node) {
			do {
				if (node.tagName && node.tagName.includes('-'))
					return node;
			} while (node = node.parentNode);
		}

		// TODO: Only trigger if we modify nodes inside an ExprPath.
		// TODO: Enable this even when not in dev mode, because it's so useful for debugging?
		// But it modifies the top level prototypes.
		// TODO: Remove the onBeforeMutation callback when this.rootEl is not in the document.
		// Because we won't get notified of document changes then anyway.
		if (this.rootEl && this.rootEl.ownerDocument?.defaultView) { // TODO: Bind whenever we have rootEl.
			this.mutationWatcher = MutationWatcher.getFromDocument(this.rootEl.ownerDocument);
			this.mutationWatcher.onBeforeMutation.push((node, action, args) => {
				
				// If a modification was made
				if (this.mutationWatcherEnabled) {
					if (this.rootEl.contains(node) && closestCustomElement(node) === this.rootEl) {
						//console.log(node, action, args);
						//throw new Error('DOM modification');
					}
					
					// If another DOM node steals one of ours by adding it to itself.
					// TODO: append can use multiple arguments.
					if (['insertBefore', 'append', 'appendChild'].includes(action)
						&& this.rootEl.contains(args[0]) && closestCustomElement(args[0]) === this.rootEl) {
						
						//console.log(node, action, args);
						//throw new Error('Another element attempted to steal one of our nodes.');
					}
				}
			});
		}
		//#ENDIF
		*/
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
			/*#IFDEV*/assert(ng.exactKey === exactKey);/*#ENDIF*/
			
			// Mark close-key version as in-use.
			let closeNg = this.nodeGroupsAvailable.delete(ng.closeKey, ng);
			/*#IFDEV*/assert(closeNg);/*#ENDIF*/

			// Mark our self as in-use.
			this.nodeGroupsInUse.push(ng)

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
						assert(success);

						let success2 = this.nodeGroupsAvailable.delete(ng2.closeKey, ng2);
						assert(success2);
						/*#IFDEV*/assert(success === success2)/*#ENDIF*/

						// console.log(getHtml(ng2))
						if (success) {
							this.nodeGroupsInUse.push(ng2)
						}
					}
				}
			}

			// Recurse to mark all child NodeGroups as in-use.
			for (let path of ng.paths)
				for (let childNg of path.nodeGroups) {
					if (!childNg.inUse) {
						this.findAndDeleteExact(childNg.exactKey, false, childNg);
					//	this.findAndDeleteClose(childNg.closeKey, childNg.exactKey, false);
					}
					childNg.inUse = true;
				}
			
			if (ng.parentPath) {
				//ng.parentPath.clearNodesCache();
				// ng.parentPath = null;
				//ng.parentPath.removeNodeGroup(ng);
			}

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
			/*#IFDEV*/assert(ng.exactKey);/*#ENDIF*/
			let exactNg = this.nodeGroupsAvailable.delete(ng.exactKey, ng);
			
			/*#IFDEV*/assert(exactNg);/*#ENDIF*/
			/*#IFDEV*/assert(ng === exactNg)/*#ENDIF*/
			
			
			ng.inUse = true;
			if (goUp) {
				let ng2 = ng;

				// We borrowed a node from another node group so make sure its parent isn't still an exact match.
				while (ng2 = ng2?.parentPath?.parentNg) {
					if (!ng2.inUse) {
						ng2.inUse = true; // Might speed it up slightly?
						/*#IFDEV*/assert(ng2.exactKey);/*#ENDIF*/
						let success = this.nodeGroupsAvailable.delete(ng2.exactKey, ng2);
						/*#IFDEV*/assert(success);/*#ENDIF*/

						// But it can still be a close match, so we remove it there too.
						/*#IFDEV*/assert(ng2.closeKey);/*#ENDIF*/
						success = this.nodeGroupsAvailable.delete(ng2.closeKey, ng2);
						/*#IFDEV*/assert(success);/*#ENDIF*/

						this.nodeGroupsInUse.push(ng2);
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
			this.nodeGroupsInUse.push(ng)
			
			
			if (ng.parentPath) {
				//ng.parentPath.clearNodesCache();
				//ng.parentPath = null;
				//ng.parentPath.removeNodeGroup(ng);
			}
		}
		
		
		return ng;
	}

	/**
	 * Get an existing or create a new NodeGroup that matches the template,
	 * but don't reparent it if it's somewhere else.
	 * @param template {Template}
	 * @param exact {?boolean} If true, only get a NodeGroup if it matches both the template
	 * @param replaceMode {?boolean} If true, use the template to replace an existing element, instead of appending children to it.
	 * @return {?NodeGroup} */
	getNodeGroup(template, exact=null, replaceMode=null, exactKey=null) {
		exactKey = exactKey || getObjectHash(template);

		/*#IFDEV*/if(logEnabled) this.log(`Looking for ${exact ? 'exact' : 'close'} match: ` + template.debug)/*#ENDIF*/

		// 1. Try to find an exact match.
		let ng = this.findAndDeleteExact(exactKey);
		if (exact && !ng) {
			/*#IFDEV*/this.log(`Not found.`)/*#ENDIF*/
			return null;
		}
		/*#IFDEV*/if (logEnabled) this.log(`Found exact: ` + ng.debug);/*#ENDIF*/

		// 2.  Try to find a close match.
		if (!ng) {
			// We don't need to delete the exact match bc it's already been deleted in the prev pass.
			let closeKey = template.getCloseKey();
			ng = this.findAndDeleteClose(closeKey, exactKey);

			// 2. Update expression values if they've changed.
			if (ng) {
				/*#IFDEV*/if (logEnabled) this.log(`Found close: ` + closeKey + '   ' + ng.debug);/*#ENDIF*/
				/*#IFDEV*/this.incrementLogDepth(1);/*#ENDIF*/
				/*#IFDEV*/ng.verify();/*#ENDIF*/

				ng.applyExprs(template.exprs);

				/*#IFDEV*/ng.verify();/*#ENDIF*/
				/*#IFDEV*/this.incrementLogDepth(-1);/*#ENDIF*/
				/*#IFDEV*/if (logEnabled) this.log(`Updated close to: ` + ng.debug);/*#ENDIF*/
			}

			// 3. Or if not found, create a new NodeGroup
			else {
				/*#IFDEV*/this.incrementLogDepth(1);/*#ENDIF*/

				ng = new NodeGroup(template, this, replaceMode, exactKey, closeKey);

				/*#IFDEV*/this.incrementLogDepth(-1);/*#ENDIF*/
				/*#IFDEV*/this.modifications.created.push(...ng.getNodes())/*#ENDIF*/


				// 4. Mark NodeGroup as being in-use.
				// TODO: Moving from one group to another thrashes the gc.  Is there a faster way?
				// Could I have just a single WeakSet of those in use?
				// Perhaps also result could cache its last exprKey and then we'd use only one map?
				ng.exactKey = exactKey;
				ng.closeKey = closeKey;
				this.nodeGroupsInUse.push(ng)

				/*#IFDEV*/if (logEnabled) this.log(`Created new ` + ng.debug)/*#ENDIF*/
			}
		}
		
		// New!
		// We clear the parent PathExpr's nodesCache when we remove ourselves from it.
		// Benchmarking shows this doesn't slow down the partialUpdate benchmark.
		if (ng.parentPath) {
			// ng.parentPath.clearNodesCache(); // Makes partialUpdate benchmark 10x slower!
		 	ng.parentPath = null;
		}


		/*#IFDEV*/ng.verify()/*#ENDIF*/
		
		return ng;
	}

	/**
	 * Move everything in nodeGroupsInUse to nodeGroupsAvailable.
	 * This is called after the NodeGroup has finished rendering. */
	reset() {

		/*#IFDEV*/this.rootNg.verify();/*#ENDIF*/

		//this.changes = [];
		let available = this.nodeGroupsAvailable
		for (let ng of this.nodeGroupsInUse) {
			ng.inUse = false;
			available.add(ng.exactKey, ng)
			available.add(ng.closeKey, ng)
		}
		this.nodeGroupsInUse = [];

		// Used for watches
		this.changes = [];

		/*#IFDEV*/this.log('----------------------')/*#ENDIF*/
		// TODO: free the memory from any nodeGroupsAvailable() after render is done, since they weren't used?


		/*#IFDEV*/this.rootNg.verify();/*#ENDIF*/
	}

	resetModifications() {
		this.modifications = {
			created: [],
			updated: [],
			moved: [],
			deleted: []
		};
	}

	/**
	 * Get the NodeGroupManager for a Web Component, given either its root element or its Template.
	 * If given a Template, create a new NodeGroup.
	 * Using a Template is typically used when creating a standalone component.
	 * @param rootEl {Solarite|HTMLElement|Template}
	 * @return {NodeGroupManager} */
	static get(rootEl=null) {
		let ngm;
		if (rootEl instanceof Template) {
			ngm = new NodeGroupManager();
			ngm.rootNg = ngm.getNodeGroup(rootEl, false);
			let el = ngm.rootNg.getRootNode();
			Globals.nodeGroupManagers.set(el, ngm);
		}
		else {

			ngm = Globals.nodeGroupManagers.get(rootEl);
			if (!ngm) {
				ngm = new NodeGroupManager(rootEl);
				Globals.nodeGroupManagers.set(rootEl, ngm);
			}
		}

		return ngm;
	}


	//#IFDEV

	incrementLogDepth(level) {
		this.logDepth += level;
	}
	log(msg, level=0) {
		this.logDepth += level;
		if (logEnabled) {
			let indent = '	'.repeat(this.logDepth);
			console.log(indent + msg);
		}
	}

	/**
	 * @returns {NodeGroup[]} */
	getAllAvailableGroups() {
		let result = new Set();
		for (let values of Object.values(this.nodeGroupsAvailable.data))
			result.add(...values)
		return [...result];
	}

	verify() {
		if (!window.verify)
			return;

		
		let findCloseMatch = item => {
			let names = this.nodeGroupsAvailable.hasValue(item);
			for (let name of names)
				if (name.startsWith('@'))
					return true;
			return false;
		}

		// Check to make sure every exact match is also in close matches.
		for (let name in this.nodeGroupsAvailable)
			if (!name.startsWith('@)'))
				for (let item of this.nodeGroupsAvailable.getAll(name))
					assert(findCloseMatch(item))

		// Recursively traverse through all node Groups
		if (this.rootNg)
			this.rootNg.verify();

		for (let ng of this.getAllAvailableGroups())
			ng.verify();
	}
	//#ENDIF
}

NodeGroupManager.pendingChildren = [];

//#IFDEV
let logEnabled = false // Prevent rollup's static analyzer from removing this.
//#ENDIF


export class LoopInfo {
	constructor(loopTemplate, itemTransformer) {
		this.template = loopTemplate
		this.itemTransformer = itemTransformer;
	}
}
