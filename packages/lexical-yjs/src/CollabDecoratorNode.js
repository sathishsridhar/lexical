/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type {DecoratorNode, NodeKey, DecoratorMap, NodeMap} from 'lexical';
import type {Binding} from '.';
import type {CollabElementNode} from './CollabElementNode';
import type {XmlElement} from 'yjs';

import {$isDecoratorNode, $getNodeByKey} from 'lexical';
import {syncPropertiesFromLexical, syncPropertiesFromYjs} from './Utils';
import {Map as YMap} from 'yjs';
import {
  observeDecoratorMap,
  syncLexicalDecoratorMapToYjs,
  syncYjsDecoratorMapToLexical,
} from './SyncDecoratorStates';

export class CollabDecoratorNode {
  _xmlElem: XmlElement;
  _key: NodeKey;
  _parent: CollabElementNode;
  _type: string;
  _unobservers: Set<() => void>;

  constructor(xmlElem: XmlElement, parent: CollabElementNode, type: string) {
    this._key = '';
    this._xmlElem = xmlElem;
    this._parent = parent;
    this._type = type;
    this._unobservers = new Set();
  }

  getPrevNode(nodeMap: null | NodeMap): null | DecoratorNode {
    if (nodeMap === null) {
      return null;
    }
    const node = nodeMap.get(this._key);
    return $isDecoratorNode(node) ? node : null;
  }

  getNode(): null | DecoratorNode {
    const node = $getNodeByKey(this._key);
    return $isDecoratorNode(node) ? node : null;
  }

  getSharedType(): XmlElement {
    return this._xmlElem;
  }

  getType(): string {
    return this._type;
  }

  getKey(): NodeKey {
    return this._key;
  }

  getSize(): number {
    return 1;
  }

  getOffset(): number {
    const collabElementNode = this._parent;
    return collabElementNode.getChildOffset(this);
  }

  syncPropertiesFromLexical(
    binding: Binding,
    nextLexicalNode: DecoratorNode,
    prevNodeMap: null | NodeMap,
  ): void {
    const prevLexicalNode = this.getPrevNode(prevNodeMap);
    const xmlElem = this._xmlElem;
    const prevDecoratorMap: DecoratorMap | null =
      prevLexicalNode === null ? null : prevLexicalNode.__state;
    const nextDecoratorMap: DecoratorMap = nextLexicalNode.__state;

    syncPropertiesFromLexical(
      binding,
      xmlElem,
      prevLexicalNode,
      nextLexicalNode,
    );

    // Handle bindings
    if (prevDecoratorMap !== nextDecoratorMap) {
      const yjsMap = new YMap();
      xmlElem.insert(0, [yjsMap]);
      // $FlowFixMe: internal field
      yjsMap._lexicalValue = nextDecoratorMap;
      // $FlowFixMe: internal field
      yjsMap._collabNode = this;
      syncLexicalDecoratorMapToYjs(binding, this, nextDecoratorMap, yjsMap);
      observeDecoratorMap(binding, this, nextDecoratorMap, yjsMap);
    }
  }

  syncPropertiesFromYjs(
    binding: Binding,
    keysChanged: null | Set<string>,
  ): void {
    const lexicalNode = this.getNode();
    if (lexicalNode === null) {
      throw new Error('Should never happen');
    }
    const xmlElem = this._xmlElem;
    // $FlowFixMe: should always be true
    const yjsMap: YMap = xmlElem.firstChild;
    const decoratorMap = lexicalNode.__state;
    // $FlowFixMe: internal field
    yjsMap._lexicalValue = decoratorMap;
    // $FlowFixMe: internal field
    yjsMap._collabNode = this;

    syncPropertiesFromYjs(binding, xmlElem, lexicalNode, keysChanged);
    syncYjsDecoratorMapToLexical(binding, this, yjsMap, decoratorMap, null);
    observeDecoratorMap(binding, this, decoratorMap, yjsMap);
  }

  destroy(binding: Binding): void {
    const collabNodeMap = binding.collabNodeMap;
    collabNodeMap.delete(this._key);
    this._unobservers.forEach((unobserver) => unobserver());
    this._unobservers.clear();
  }
}

export function $createCollabDecoratorNode(
  xmlElem: XmlElement,
  parent: CollabElementNode,
  type: string,
): CollabDecoratorNode {
  const collabNode = new CollabDecoratorNode(xmlElem, parent, type);
  // $FlowFixMe: internal field
  xmlElem._collabNode = collabNode;
  return collabNode;
}