import Template from "./Template.js";
import NodeGroupManager from "./NodeGroupManager.js";

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
export default function r(htmlStrings=undefined, ...exprs) {

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
                rendered.add(parent)
                let template = r(htmlStrings, ...exprs);
                let ngm = NodeGroupManager.get(parent);
                return ngm.render(template, options);
            }
        }

        // null for expr[0], remove whole element.
        else {
            let ngm = NodeGroupManager.get(parent);
            ngm.render(null, exprs[1])
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
            ngm.render(template)
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
export {rendered}