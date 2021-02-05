import { Y as YArray, a as YMap, b as YText, C as ContentString, c as YArrayEvent, d as YMapEvent, e as YTextEvent } from './common/yjs-95ac26e6.js';
import { a as Element, b as Text, E as Editor } from './common/index.es-71fa96c1.js';
import './common/observable-363df4ab.js';
import './common/map-c5ea9815.js';
import './common/math-91bb74dc.js';
import './common/encoding-7fdf95b6.js';
import './common/buffer-551584fe.js';
import './common/process-2545f00a.js';
import './common/binary-e1a1f68b.js';
import './common/decoding-6e54b617.js';
import './common/function-debeb549.js';
import './common/object-034d355c.js';
import './common/time-c2bb43f3.js';
import './common/_commonjsHelpers-8c19dec8.js';

var prefix = 'Invariant failed';
function invariant(condition, message) {
    if (condition) {
        return;
    }
    {
        throw new Error(prefix);
    }
}

const SyncElement = {
    getText(element) {
        return element === null || element === void 0 ? void 0 : element.get('text');
    },
    getChildren(element) {
        return element === null || element === void 0 ? void 0 : element.get('children');
    },
};
const SyncNode = {
    getChildren(node) {
        if (node instanceof YArray) {
            return node;
        }
        return SyncElement.getChildren(node);
    },
    getText(node) {
        if (node instanceof YArray) {
            return undefined;
        }
        return SyncElement.getText(node);
    },
};

/**
 * Converts a sync element to a slate node
 *
 * @param element
 */
function toSlateNode(element) {
    const text = SyncElement.getText(element);
    const children = SyncElement.getChildren(element);
    const node = {};
    if (text !== undefined) {
        node.text = text.toString();
    }
    if (children !== undefined) {
        node.children = children.map(toSlateNode);
    }
    Array.from(element.entries()).forEach(([key, value]) => {
        if (key !== 'children' && key !== 'text') {
            node[key] = value;
        }
    });
    return node;
}
/**
 * Converts a SharedType to a Slate doc
 * @param doc
 */
function toSlateDoc(doc) {
    return doc.map(toSlateNode);
}
/**
 * Converts a slate node to a sync element
 *
 * @param node
 */
function toSyncElement(node) {
    const element = new YMap();
    if (Element.isElement(node)) {
        const childElements = node.children.map(toSyncElement);
        const childContainer = new YArray();
        childContainer.insert(0, childElements);
        element.set('children', childContainer);
    }
    if (Text.isText(node)) {
        const textElement = new YText(node.text);
        element.set('text', textElement);
    }
    Object.entries(node).forEach(([key, value]) => {
        if (key !== 'children' && key !== 'text') {
            element.set(key, value);
        }
    });
    return element;
}
/**
 * Converts all elements int a Slate doc to SyncElements and adds them
 * to the SharedType
 *
 * @param sharedType
 * @param doc
 */
function toSharedType(sharedType, doc) {
    sharedType.insert(0, doc.map(toSyncElement));
}
/**
 * Converts a SharedType path the a slate path
 *
 * @param path
 */
function toSlatePath(path) {
    return path.filter((node) => typeof node === 'number');
}

const isTree = (node) => !!SyncNode.getChildren(node);
/**
 * Returns the SyncNode referenced by the path
 *
 * @param doc
 * @param path
 */
function getTarget(doc, path) {
    function iterate(current, idx) {
        const children = SyncNode.getChildren(current);
        if (!isTree(current) || !(children === null || children === void 0 ? void 0 : children.get(idx))) {
            throw new TypeError(`path ${path.toString()} does not match doc ${JSON.stringify(toSlateDoc(doc))}`);
        }
        return children.get(idx);
    }
    return path.reduce(iterate, doc);
}
function getParentPath(path, level = 1) {
    if (level > path.length) {
        throw new TypeError('requested ancestor is higher than root');
    }
    return [path[path.length - level], path.slice(0, path.length - level)];
}
function getParent(doc, path, level = 1) {
    const [idx, parentPath] = getParentPath(path, level);
    const parent = getTarget(doc, parentPath);
    invariant(parent);
    return [parent, idx];
}

/**
 * Applies an insert node operation to a SharedType.
 *
 * @param doc
 * @param op
 */
function insertNode(doc, op) {
    const [parent, index] = getParent(doc, op.path);
    const children = SyncNode.getChildren(parent);
    if (SyncNode.getText(parent) !== undefined || !children) {
        throw new TypeError("Can't insert node into text node");
    }
    invariant(children);
    children.insert(index, [toSyncElement(op.node)]);
    return doc;
}

function cloneSyncElement(element) {
    const text = SyncElement.getText(element);
    const children = SyncElement.getChildren(element);
    const clone = new YMap();
    if (text !== undefined) {
        const textElement = new YText(text.toString());
        clone.set('text', textElement);
    }
    if (children !== undefined) {
        const childElements = children.map(cloneSyncElement);
        const childContainer = new YArray();
        childContainer.insert(0, childElements);
        clone.set('children', childContainer);
    }
    Array.from(element.entries()).forEach(([key, value]) => {
        if (key !== 'children' && key !== 'text') {
            clone.set(key, value);
        }
    });
    return clone;
}

/**
 * Applies a merge node operation to a SharedType.
 *
 * @param doc
 * @param op
 */
function mergeNode(doc, op) {
    const [parent, index] = getParent(doc, op.path);
    const children = SyncNode.getChildren(parent);
    invariant(children);
    const prev = children.get(index - 1);
    const next = children.get(index);
    const prevText = SyncNode.getText(prev);
    const nextText = SyncNode.getText(next);
    if (prevText && nextText) {
        prevText.insert(prevText.length, nextText.toString());
    }
    else {
        const nextChildren = SyncNode.getChildren(next);
        const prevChildren = SyncNode.getChildren(prev);
        invariant(nextChildren);
        invariant(prevChildren);
        const toPush = nextChildren.map(cloneSyncElement);
        prevChildren.push(toPush);
    }
    children.delete(index, 1);
    return doc;
}

/**
 * Applies a move node operation to a SharedType.
 *
 * @param doc
 * @param op
 */
function moveNode(doc, op) {
    const [from, fromIndex] = getParent(doc, op.path);
    const [to, toIndex] = getParent(doc, op.newPath);
    if (SyncNode.getText(from) !== undefined ||
        SyncNode.getText(to) !== undefined) {
        throw new TypeError("Can't move node as child of a text node");
    }
    const fromChildren = SyncNode.getChildren(from);
    const toChildren = SyncNode.getChildren(to);
    invariant(fromChildren);
    invariant(toChildren);
    const toMove = fromChildren.get(fromIndex);
    const toInsert = cloneSyncElement(toMove);
    fromChildren.delete(fromIndex);
    toChildren.insert(Math.min(toIndex, toChildren.length), [toInsert]);
    return doc;
}

/**
 * Applies a remove node operation to a SharedType.
 *
 * @param doc
 * @param op
 */
function removeNode(doc, op) {
    const [parent, index] = getParent(doc, op.path);
    if (SyncNode.getText(parent) !== undefined) {
        throw new TypeError("Can't remove node from text node");
    }
    const children = SyncNode.getChildren(parent);
    invariant(children);
    children.delete(index);
    return doc;
}

/**
 * Applies a setNode operation to a SharedType
 *
 * @param doc
 * @param op
 */
function setNode(doc, op) {
    const node = getTarget(doc, op.path);
    Object.entries(op.newProperties).forEach(([key, value]) => {
        if (key === 'children' || key === 'text') {
            throw new Error(`Cannot set the "${key}" property of nodes!`);
        }
        node.set(key, value);
    });
    return doc;
}

/**
 * Applies a split node operation to a SharedType
 *
 * @param doc
 * @param op
 */
function splitNode(doc, op) {
    const [parent, index] = getParent(doc, op.path);
    const children = SyncNode.getChildren(parent);
    invariant(children);
    const target = children.get(index);
    const inject = cloneSyncElement(target);
    children.insert(index + 1, [inject]);
    if (SyncNode.getText(target) !== undefined) {
        const targetText = SyncNode.getText(target);
        const injectText = SyncNode.getText(inject);
        invariant(targetText);
        invariant(injectText);
        if (targetText.length > op.position) {
            targetText.delete(op.position, targetText.length - op.position);
        }
        if (injectText !== undefined && op.position !== undefined) {
            injectText.delete(0, op.position);
        }
    }
    else {
        const targetChildren = SyncNode.getChildren(target);
        const injectChildren = SyncNode.getChildren(inject);
        invariant(targetChildren);
        invariant(injectChildren);
        targetChildren.delete(op.position, targetChildren.length - op.position);
        if (op.position !== undefined) {
            injectChildren.delete(0, op.position);
        }
    }
    return doc;
}

const mapper = {
    insert_node: insertNode,
    merge_node: mergeNode,
    move_node: moveNode,
    remove_node: removeNode,
    set_node: setNode,
    split_node: splitNode,
};

/**
 * Applies a insert text operation to a SharedType.
 *
 * @param doc
 * @param op
 */
function insertText(doc, op) {
    const node = getTarget(doc, op.path);
    const nodeText = SyncElement.getText(node);
    nodeText.insert(op.offset, op.text);
    return doc;
}

/**
 * Applies a remove text operation to a SharedType.
 *
 * @param doc
 * @param op
 */
function removeText(doc, op) {
    const node = getTarget(doc, op.path);
    const nodeText = SyncElement.getText(node);
    nodeText.delete(op.offset, op.text.length);
    return doc;
}

const mappers = {
    insert_text: insertText,
    remove_text: removeText,
};

const nullOp = (doc) => doc;
const opMappers = Object.assign(Object.assign(Object.assign({}, mappers), mapper), { 
    // SetSelection is currently a null op since we don't support cursors
    set_selection: nullOp });
/**
 * Applies a slate operation to a SharedType
 *
 * @param doc
 * @param op
 */
function applySlateOp(doc, op) {
    const apply = opMappers[op.type];
    if (!apply) {
        throw new Error(`Unknown operation: ${op.type}`);
    }
    return apply(doc, op);
}
/**
 * Applies a slate operations to a SharedType
 *
 * @param doc
 * @param op
 */
function applySlateOps(doc, operations) {
    return operations.reduce(applySlateOp, doc);
}

/**
 * Converts a Yjs Array event into Slate operations.
 *
 * @param event
 */
function arrayEvent(event) {
    const eventTargetPath = toSlatePath(event.path);
    function createRemoveNode(index) {
        const path = [...eventTargetPath, index];
        const node = { type: 'paragraph', children: [{ text: '' }] };
        return { type: 'remove_node', path, node };
    }
    function createInsertNode(index, element) {
        const path = [...eventTargetPath, index];
        const node = toSlateNode(element);
        return { type: 'insert_node', path, node };
    }
    const sortFunc = (a, b) => a.path[a.path.length - 1] > b.path[b.path.length - 1] ? 1 : 0;
    let removeIndex = 0;
    let addIndex = 0;
    let removeOps = [];
    let addOps = [];
    event.changes.delta.forEach((delta) => {
        if ('retain' in delta) {
            removeIndex += delta.retain;
            addIndex += delta.retain;
            return;
        }
        if ('delete' in delta) {
            for (let i = 0; i < delta.delete; i += 1) {
                removeOps.push(createRemoveNode(removeIndex));
            }
            return;
        }
        if ('insert' in delta) {
            addOps.push(
            // eslint-disable-next-line no-loop-func
            ...delta.insert.map((e, i) => createInsertNode(addIndex + i, e)));
            addIndex += delta.insert.length;
        }
    });
    removeOps = removeOps.sort(sortFunc);
    addOps = addOps.sort(sortFunc);
    return [...removeOps, ...addOps];
}

/**
 * Converts a Yjs Map event into Slate operations.
 *
 * @param event
 */
function mapEvent(event) {
    const convertMapOp = (actionEntry) => {
        const [key, action] = actionEntry;
        const targetElement = event.target;
        return {
            newProperties: { [key]: targetElement.get(key) },
            properties: { [key]: action.oldValue },
        };
    };
    const combineMapOp = (op, props) => {
        return Object.assign(Object.assign({}, op), { newProperties: Object.assign(Object.assign({}, op.newProperties), props.newProperties), properties: Object.assign(Object.assign({}, op.properties), props.properties) });
    };
    const { keys } = event.changes;
    const changes = Array.from(keys.entries(), convertMapOp);
    const baseOp = {
        type: 'set_node',
        newProperties: {},
        properties: {},
        path: toSlatePath(event.path),
    };
    // Combine changes into a single set node operation
    return [changes.reduce(combineMapOp, baseOp)];
}

/**
 * Converts a Yjs Text event into Slate operations.
 *
 * @param event
 */
function textEvent(event) {
    const eventTargetPath = toSlatePath(event.path);
    const createTextOp = (type, offset, text) => {
        return {
            type,
            offset,
            text,
            path: eventTargetPath,
        };
    };
    const removedValues = event.changes.deleted.values();
    let removeOffset = 0;
    let addOffset = 0;
    const removeOps = [];
    const addOps = [];
    event.changes.delta.forEach((delta) => {
        if ('retain' in delta) {
            removeOffset += delta.retain;
            addOffset += delta.retain;
            return;
        }
        if ('delete' in delta) {
            let text = '';
            while (text.length < delta.delete) {
                const item = removedValues.next().value;
                const { content } = item;
                if (!(content instanceof ContentString)) {
                    throw new TypeError(`Unsupported content type ${item.content}`);
                }
                text = text.concat(content.str);
            }
            if (text.length !== delta.delete) {
                throw new Error(`Unexpected length: expected ${delta.delete}, got ${text.length}`);
            }
            removeOps.push(createTextOp('remove_text', removeOffset, text));
            return;
        }
        if ('insert' in delta) {
            addOps.push(createTextOp('insert_text', addOffset, delta.insert.join('')));
            addOffset += delta.insert.length;
        }
    });
    return [...removeOps, ...addOps];
}

/**
 * Converts a yjs event into slate operations.
 *
 * @param event
 */
function toSlateOp(event) {
    if (event instanceof YArrayEvent) {
        return arrayEvent(event);
    }
    if (event instanceof YMapEvent) {
        return mapEvent(event);
    }
    if (event instanceof YTextEvent) {
        return textEvent(event);
    }
    throw new Error('Unsupported yjs event');
}
/**
 * Converts yjs events into slate operations.
 *
 * @param events
 */
function toSlateOps(events) {
    return events.flatMap(toSlateOp);
}

const YjsEditor = {
    /**
     * Set the editor value to the content of the to the editor bound shared type.
     */
    synchronizeValue: (e) => {
        Editor.withoutNormalizing(e, () => {
            e.children = toSlateDoc(e.sharedType);
            e.onChange();
        });
    },
    /**
     * Apply slate ops to Yjs
     */
    applySlateOps: (e, operations) => {
        invariant(e.sharedType.doc);
        e.isLocal = true;
        e.sharedType.doc.transact(() => {
            applySlateOps(e.sharedType, operations);
        });
        // eslint-disable-next-line no-return-assign
        Promise.resolve().then(() => (e.isLocal = false));
    },
    /**
     * Apply Yjs events to slate
     */
    applyYJsEvents: (e, events) => {
        e.isRemote = true;
        Editor.withoutNormalizing(e, () => {
            toSlateOps(events).forEach((op) => {
                e.apply(op);
            });
        });
        // eslint-disable-next-line no-return-assign
        Promise.resolve().then(() => (e.isRemote = false));
    },
};
function withYjs(editor, sharedType) {
    const e = editor;
    e.sharedType = sharedType;
    e.isRemote = false;
    e.isLocal = false;
    setTimeout(() => {
        YjsEditor.synchronizeValue(e);
    });
    sharedType.observeDeep((events) => {
        if (!e.isLocal) {
            YjsEditor.applyYJsEvents(e, events);
        }
    });
    const { onChange } = editor;
    e.onChange = () => {
        if (!e.isRemote) {
            YjsEditor.applySlateOps(e, e.operations);
        }
        if (onChange) {
            onChange();
        }
    };
    return e;
}

export { toSharedType, withYjs };
