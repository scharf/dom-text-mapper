// Generated by CoffeeScript 1.6.3
(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  window.DomTextMapper = (function(_super) {
    var SELECT_CHILDREN_INSTEAD, USE_EMPTY_TEXT_WORKAROUND, USE_TABLE_TEXT_WORKAROUND, WATCHED_PATHS, WHITESPACE;

    __extends(DomTextMapper, _super);

    DomTextMapper.applicable = function() {
      return true;
    };

    USE_TABLE_TEXT_WORKAROUND = true;

    USE_EMPTY_TEXT_WORKAROUND = true;

    SELECT_CHILDREN_INSTEAD = ["table", "thead", "tbody", "tfoot", "ol", "a", "caption", "p", "span", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "li", "form"];

    WATCHED_PATHS = ["./DIV[3]/DIV[5]/DIV[2]", "./DIV[3]/DIV[5]/DIV[2]/DIV[2]"];

    DomTextMapper.instances = 0;

    function DomTextMapper(_options) {
      var _ref;
      this._options = _options != null ? _options : {};
      this._onMutation = __bind(this._onMutation, this);
      this._getEndInfoForNode = __bind(this._getEndInfoForNode, this);
      this._getStartInfoForNode = __bind(this._getStartInfoForNode, this);
      this._startScan = __bind(this._startScan, this);
      this._getMappingsForCharRange = __bind(this._getMappingsForCharRange, this);
      DomTextMapper.__super__.constructor.call(this, (_ref = this._options.id) != null ? _ref : "d-t-m #" + DomTextMapper.instances);
      if (this._options.rootNode != null) {
        this.setRootNode(this._options.rootNode);
      } else {
        this.setRealRoot();
      }
      DomTextMapper.instances += 1;
    }

    DomTextMapper.prototype.setRootNode = function(rootNode) {
      this._rootWin = window;
      return this._pathStartNode = this._changeRootNode(rootNode);
    };

    DomTextMapper.prototype.setRootId = function(rootId) {
      return this.setRootNode(document.getElementById(rootId));
    };

    DomTextMapper.prototype.setRootIframe = function(iframeId) {
      var iframe;
      iframe = window.document.getElementById(iframeId);
      if (iframe == null) {
        throw new Error("Can't find iframe with specified ID!");
      }
      this._rootWin = iframe.contentWindow;
      if (this._rootWin == null) {
        throw new Error("Can't access contents of the specified iframe!");
      }
      this._changeRootNode(this._rootWin.document);
      return this._pathStartNode = this._getBody();
    };

    DomTextMapper.prototype.setRealRoot = function() {
      this._rootWin = window;
      this._changeRootNode(document);
      return this._pathStartNode = this._getBody();
    };

    DomTextMapper.prototype.setExpectedContent = function(content) {
      return this._expectedContent = content;
    };

    DomTextMapper.prototype._selectPath = function(path, scroll) {
      var node;
      if (scroll == null) {
        scroll = false;
      }
      node = this._lookUpNode(path);
      return this._selectNode(node, scroll);
    };

    DomTextMapper.prototype._getMappingsForCharRange = function(start, end) {
      var changedChar, changedCorpus, changedText, endIndex, endInfo, endMapping, endNode, endOffset, endPath, i, index, info, mappings, node, nodes, origChar, origCorpus, origText, pcs, r, result, startIndex, startInfo, startMapping, startNode, startOffset, startPath, _i, _len,
        _this = this;
      if (!((start != null) && (end != null))) {
        throw new Error("start and end is required!");
      }
      nodes = this._collectAllTextNodes();
      this._saveSelection();
      origCorpus = this._getFreshCorpus(false, true);
      pcs = {};
      index = 0;
      for (_i = 0, _len = nodes.length; _i < _len; _i++) {
        node = nodes[_i];
        origText = node.nodeValue;
        if (!origText.length) {
          continue;
        }
        origChar = origText[0];
        changedChar = origChar === "." ? "," : ".";
        changedText = changedChar + origText.substring(1);
        node.nodeValue = changedText;
        changedCorpus = this._getFreshCorpus(false, true);
        startIndex = this._getDiffIndex(origCorpus, changedCorpus);
        origChar = origText[origText.length - 1];
        changedChar = origChar === "." ? "," : ".";
        changedText = origText.substr(0, origText.length - 1) + changedChar;
        node.nodeValue = changedText;
        changedCorpus = this._getFreshCorpus(false, true);
        endIndex = 1 + this._getDiffIndex(origCorpus, changedCorpus);
        node.nodeValue = origText;
        if (endIndex === startIndex + 1) {
          continue;
        }
        pcs[++index] = {
          start: startIndex,
          end: endIndex,
          node: node,
          content: origCorpus.slice(startIndex, endIndex)
        };
      }
      this._restoreSelection();
      mappings = [];
      for (i in pcs) {
        info = pcs[i];
        if (this._regions_overlap(info.start, info.end, start, end)) {
          (function(info) {
            var full, mapping;
            mapping = {
              element: info
            };
            full = start <= info.start && info.end <= end;
            if (full) {
              mapping.full = true;
              mapping.wanted = info.content;
              mapping.yields = info.content;
              mapping.startCorrected = 0;
              mapping.endCorrected = 0;
            } else {
              if (info.node.nodeType === Node.TEXT_NODE) {
                if (start <= info.start) {
                  mapping.end = end - info.start;
                  mapping.wanted = info.content.substr(0, mapping.end);
                } else if (info.end <= end) {
                  mapping.start = start - info.start;
                  mapping.wanted = info.content.substr(mapping.start);
                } else {
                  mapping.start = start - info.start;
                  mapping.end = end - info.start;
                  mapping.wanted = info.content.substr(mapping.start, mapping.end - mapping.start);
                }
                _this._computeSourcePositions(mapping);
                mapping.yields = info.node.data.substr(mapping.startCorrected, mapping.endCorrected - mapping.startCorrected);
              } else if ((info.node.nodeType === Node.ELEMENT_NODE) && (info.node.tagName.toLowerCase() === "img")) {
                _this._log("Can not select a sub-string from the title of an image. Selecting all.");
                mapping.full = true;
                mapping.wanted = info.content;
              } else {
                _this._log("Warning: no idea how to handle partial mappings for node type " + info.node.nodeType);
                if (info.node.tagName != null) {
                  _this._log("Tag: " + info.node.tagName);
                }
                _this._log("Selecting all.");
                mapping.full = true;
                mapping.wanted = info.content;
              }
            }
            return mappings.push(mapping);
          })(info);
        }
      }
      if (mappings.length === 0) {
        this._log("Collecting nodes for [" + start + ":" + end + "]");
        this._log("Should be: '" + this._corpus.slice(start, end) + "'.");
        throw new Error("No mappings found for [" + start + ":" + end + "]!");
      }
      mappings = mappings.sort(function(a, b) {
        return a.element.start - b.element.start;
      });
      r = this._rootWin.document.createRange();
      startMapping = mappings[0];
      startNode = startMapping.element.node;
      startPath = startMapping.element.path = this._getPathTo(startNode);
      startOffset = startMapping.startCorrected;
      if (startMapping.full) {
        r.setStartBefore(startNode);
        startInfo = startPath;
      } else {
        r.setStart(startNode, startOffset);
        startInfo = startPath + ":" + startOffset;
      }
      endMapping = mappings[mappings.length - 1];
      endNode = endMapping.element.node;
      endPath = endMapping.element.path = this._getPathTo(endNode);
      endOffset = endMapping.endCorrected;
      if (endMapping.full) {
        r.setEndAfter(endNode);
        endInfo = endPath;
      } else {
        r.setEnd(endNode, endOffset);
        endInfo = endPath + ":" + endOffset;
      }
      result = {
        mappings: mappings,
        realRange: r,
        rangeInfo: {
          startPath: startPath,
          startOffset: startOffset,
          startInfo: startInfo,
          endPath: endPath,
          endOffset: endOffset,
          endInfo: endInfo
        },
        safeParent: r.commonAncestorContainer
      };
      return {
        sections: [result]
      };
    };

    DomTextMapper.prototype.ready = function(reason, callback) {
      if (callback == null) {
        throw new Error("missing callback!");
      }
      if (this._pendingCallbacks == null) {
        this._pendingCallbacks = [];
      }
      this._pendingCallbacks.push(callback);
      this._startScan(reason);
      return null;
    };

    DomTextMapper.prototype._startScan = function() {
      this._getFreshCorpus();
      return this._scanFinished();
    };

    DomTextMapper.prototype._getFreshCorpus = function(shouldRestoreSelection, intermittent) {
      var newCorpus;
      if (shouldRestoreSelection == null) {
        shouldRestoreSelection = true;
      }
      if (intermittent == null) {
        intermittent = false;
      }
      newCorpus = this._getNodeContent(this._pathStartNode, shouldRestoreSelection);
      if (intermittent) {
        return newCorpus;
      }
      if (this._isDirty()) {
        this._ignorePos = this._findFirstIgnoredPosition();
      }
      if (this._ignorePos != null) {
        newCorpus = newCorpus.slice(0, this._ignorePos);
      }
      return this._corpus = newCorpus.trim();
    };

    DomTextMapper.prototype._findFirstTextNode = function(node) {
      var child, result, _i, _len, _ref;
      if (node.nodeType === Node.TEXT_NODE) {
        return node;
      }
      if (!node.hasChildNodes()) {
        return null;
      }
      _ref = node.childNodes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        result = this._findFirstTextNode(child);
        if (result) {
          return result;
        }
      }
      return null;
    };

    DomTextMapper.prototype._findLastTextNode = function(node) {
      var child, result, _i, _len, _ref;
      if (node.nodeType === Node.TEXT_NODE) {
        return node;
      }
      if (!node.hasChildNodes()) {
        return null;
      }
      _ref = node.childNodes.reverse();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        result = this._findLastTextNode(child);
        if (result) {
          return result;
        }
      }
      return null;
    };

    DomTextMapper.prototype._getDiffIndex = function(string1, string2) {
      var i, result, _i, _ref;
      result = -1;
      for (i = _i = 0, _ref = string1.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        if (string1[i] !== string2[i]) {
          result = i;
          break;
        }
      }
      return result;
    };

    DomTextMapper.prototype._getStartInfoForNode = function(node, shouldRestoreSelection) {
      var changedChar, changedCorpus, changedText, index, origChar, origCorpus, origText, startText;
      if (shouldRestoreSelection == null) {
        shouldRestoreSelection = true;
      }
      startText = this._findFirstTextNode(node);
      if (!startText) {
        return null;
      }
      origText = startText.nodeValue;
      if (!origText.length) {
        return null;
      }
      if (shouldRestoreSelection) {
        this._saveSelection();
      }
      origCorpus = this._getFreshCorpus(false, true);
      origChar = origText[0];
      changedChar = origChar === "." ? "," : ".";
      changedText = changedChar + origText.substring(1);
      startText.nodeValue = changedText;
      changedCorpus = this._getFreshCorpus(false, true);
      index = this._getDiffIndex(origCorpus, changedCorpus);
      startText.nodeValue = origText;
      if (shouldRestoreSelection) {
        this._restoreSelection();
      }
      if (index === -1) {
        return null;
      }
      return {
        page: 0,
        start: index
      };
    };

    DomTextMapper.prototype._getEndInfoForNode = function(node, shouldRestoreSelection) {
      var changedChar, changedCorpus, changedText, endText, index, origChar, origCorpus, origText;
      if (shouldRestoreSelection == null) {
        shouldRestoreSelection = true;
      }
      endText = this._findLastTextNode(node);
      if (!endText) {
        return null;
      }
      origText = endText.nodeValue;
      if (!origText.length) {
        return null;
      }
      if (shouldRestoreSelection) {
        this._saveSelection();
      }
      origCorpus = this._getFreshCorpus(false, true);
      origChar = origText[origText.length - 1];
      changedChar = origChar === "." ? "," : ".";
      changedText = origText.substr(0, origText.length - 1) + changedChar;
      endText.nodeValue = changedText;
      changedCorpus = this._getFreshCorpus(false, true);
      index = this._getDiffIndex(origCorpus, changedCorpus);
      endText.nodeValue = origText;
      if (shouldRestoreSelection) {
        this._restoreSelection();
      }
      if (index === -1) {
        return null;
      }
      return {
        page: 0,
        end: index + 1
      };
    };

    DomTextMapper.prototype._collectAllTextNodes = function(node, results) {
      var n, _i, _len, _ref;
      if (node == null) {
        node = null;
      }
      if (results == null) {
        results = [];
      }
      if (node == null) {
        node = this._pathStartNode;
      }
      switch (node.nodeType) {
        case Node.TEXT_NODE:
          results.push(node);
          break;
        case Node.ELEMENT_NODE:
          if (node.hasChildNodes()) {
            _ref = node.childNodes;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              n = _ref[_i];
              this._collectAllTextNodes(n, results);
            }
          }
          break;
        default:
          this._log("Ignoring node type", node.nodeType);
      }
      return results;
    };

    DomTextMapper.prototype._parentPath = function(path) {
      return path.substr(0, path.lastIndexOf("/"));
    };

    DomTextMapper.prototype._getProperNodeName = function(node) {
      var nodeName;
      nodeName = node.nodeName;
      switch (nodeName) {
        case "#text":
          return "text()";
        case "#comment":
          return "comment()";
        case "#cdata-section":
          return "cdata-section()";
        default:
          return nodeName;
      }
    };

    DomTextMapper.prototype._getNodePosition = function(node) {
      var pos, tmp;
      pos = 0;
      tmp = node;
      while (tmp) {
        if (tmp.nodeName === node.nodeName) {
          pos++;
        }
        tmp = tmp.previousSibling;
      }
      return pos;
    };

    DomTextMapper.prototype._getPathSegment = function(node) {
      var name, pos;
      name = this._getProperNodeName(node);
      pos = this._getNodePosition(node);
      return name + (pos > 1 ? "[" + pos + "]" : "");
    };

    DomTextMapper.prototype._getPathTo = function(node) {
      var origNode, xpath;
      if (!(origNode = node)) {
        throw new Error("Called getPathTo with null node!");
      }
      xpath = '';
      while (node !== this._rootNode) {
        if (node == null) {
          this._log("Root node:", this._rootNode);
          this._log("Wanted node:", origNode);
          this._log("Is this even a child?", this._rootNode.contains(origNode));
          throw new Error("Called getPathTo on a node which was not a descendant of the configured root node.");
        }
        xpath = (this._getPathSegment(node)) + '/' + xpath;
        node = node.parentNode;
      }
      xpath = (this._rootNode.ownerDocument != null ? './' : '/') + xpath;
      xpath = xpath.replace(/\/$/, '');
      return xpath;
    };

    DomTextMapper.prototype._getBody = function() {
      return (this._rootWin.document.getElementsByTagName("body"))[0];
    };

    DomTextMapper.prototype._regions_overlap = function(start1, end1, start2, end2) {
      return start1 < end2 && start2 < end1;
    };

    DomTextMapper.prototype._lookUpNode = function(path) {
      var doc, node, results, _ref;
      doc = (_ref = this._rootNode.ownerDocument) != null ? _ref : this._rootNode;
      results = doc.evaluate(path, this._rootNode, null, 0, null);
      return node = results.iterateNext();
    };

    DomTextMapper.prototype._saveSelection = function() {
      var i, r, sel;
      if (this._savedSelection != null) {
        this._log("Selection saved at:");
        this._log(this._selectionSaved);
        throw new Error("Selection already saved!");
      }
      sel = this._rootWin.getSelection();
      this._savedSelection = (function() {
        var _i, _ref, _results;
        _results = [];
        for (i = _i = 0, _ref = sel.rangeCount; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
          r = sel.getRangeAt(i);
          _results.push({
            range: r,
            endOffset: r.endOffset
          });
        }
        return _results;
      })();
      return this._selectionSaved = (new Error("selection was saved here")).stack;
    };

    DomTextMapper.prototype._restoreSelection = function() {
      var r, sel, _i, _len, _ref;
      if (this._savedSelection == null) {
        throw new Error("No selection to restore.");
      }
      sel = this._rootWin.getSelection();
      sel.removeAllRanges();
      _ref = this._savedSelection;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        r = _ref[_i];
        r.range.setEnd(r.range.endContainer, r.endOffset);
        sel.addRange(r.range);
      }
      return delete this._savedSelection;
    };

    DomTextMapper.prototype._selectNode = function(node, scroll) {
      var children, exception, realRange, sel, sn, _ref;
      if (scroll == null) {
        scroll = false;
      }
      if (node == null) {
        throw new Error("Called selectNode with null node!");
      }
      sel = this._rootWin.getSelection();
      sel.removeAllRanges();
      realRange = this._rootWin.document.createRange();
      if (node.nodeType === Node.ELEMENT_NODE && node.hasChildNodes() && (_ref = node.tagName.toLowerCase(), __indexOf.call(SELECT_CHILDREN_INSTEAD, _ref) >= 0)) {
        children = node.childNodes;
        realRange.setStartBefore(children[0]);
        realRange.setEndAfter(children[children.length - 1]);
        sel.addRange(realRange);
      } else {
        if (USE_TABLE_TEXT_WORKAROUND && node.nodeType === Node.TEXT_NODE && this._isWhitespace(node)) {

        } else {
          try {
            realRange.setStartBefore(node);
            realRange.setEndAfter(node);
            sel.addRange(realRange);
          } catch (_error) {
            exception = _error;
            if (!(USE_EMPTY_TEXT_WORKAROUND && this._isWhitespace(node))) {
              this._log("Warning: failed to scan element @ " + this.underTraverse);
              this._log("Content is: " + node.innerHTML);
              this._log("We won't be able to properly anchor to any text inside this element.");
            }
          }
        }
      }
      if (scroll) {
        sn = node;
        while ((sn != null) && (sn.scrollIntoViewIfNeeded == null)) {
          sn = sn.parentNode;
        }
        if (sn != null) {
          sn.scrollIntoViewIfNeeded();
        } else {
          this._log("Failed to scroll to element. (Browser does not support scrollIntoViewIfNeeded?)");
        }
      }
      return sel;
    };

    DomTextMapper.prototype._readSelectionText = function(sel) {
      sel || (sel = this._rootWin.getSelection());
      return sel.toString().trim().replace(/\n/g, " ").replace(/\s{2,}/g, " ");
    };

    DomTextMapper.prototype._getNodeSelectionText = function(node, shouldRestoreSelection) {
      var sel, text;
      if (shouldRestoreSelection == null) {
        shouldRestoreSelection = true;
      }
      if (shouldRestoreSelection) {
        this._saveSelection();
      }
      sel = this._selectNode(node);
      text = this._readSelectionText(sel);
      if (shouldRestoreSelection) {
        this._restoreSelection();
      }
      return text;
    };

    DomTextMapper.prototype._computeSourcePositions = function(match) {
      var dc, displayEnd, displayIndex, displayStart, displayText, sc, sourceEnd, sourceIndex, sourceStart, sourceText;
      sourceText = match.element.node.data.replace(/\n/g, " ");
      displayText = match.element.content;
      if (displayText.length > sourceText.length) {
        throw new Error("Invalid match at" + match.element.path + ": sourceText is '" + sourceText + "'," + " displayText is '" + displayText + "'.");
      }
      displayStart = match.start != null ? match.start : 0;
      displayEnd = match.end != null ? match.end : displayText.length;
      if (displayEnd === 0) {
        match.startCorrected = 0;
        match.endCorrected = 0;
        return;
      }
      sourceIndex = 0;
      displayIndex = 0;
      while (!((sourceStart != null) && (sourceEnd != null))) {
        sc = sourceText[sourceIndex];
        dc = displayText[displayIndex];
        if (sc === dc) {
          if (displayIndex === displayStart) {
            sourceStart = sourceIndex;
          }
          displayIndex++;
          if (displayIndex === displayEnd) {
            sourceEnd = sourceIndex + 1;
          }
        }
        sourceIndex++;
      }
      match.startCorrected = sourceStart;
      match.endCorrected = sourceEnd;
      return null;
    };

    DomTextMapper.prototype._getNodeContent = function(node, shouldRestoreSelection) {
      var content;
      if (shouldRestoreSelection == null) {
        shouldRestoreSelection = true;
      }
      content = this._getNodeSelectionText(node, shouldRestoreSelection);
      if ((node === this._pathStartNode) && (this._expectedContent != null)) {
        this._log("I should find out how to make actual content fit the expectations");
        content = this._expectedContent;
      }
      return content;
    };

    WHITESPACE = /^\s*$/;

    DomTextMapper.prototype._isWhitespace = function(node) {
      var child, mightBeEmpty, result;
      result = (function() {
        var _i, _len, _ref;
        switch (node.nodeType) {
          case Node.TEXT_NODE:
            return WHITESPACE.test(node.data);
          case Node.ELEMENT_NODE:
            mightBeEmpty = true;
            _ref = node.childNodes;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              child = _ref[_i];
              mightBeEmpty = mightBeEmpty && this._isWhitespace(child);
            }
            return mightBeEmpty;
          default:
            return false;
        }
      }).call(this);
      return result;
    };

    DomTextMapper.prototype.getPageIndex = function() {
      return 0;
    };

    DomTextMapper.prototype.getPageCount = function() {
      return 1;
    };

    DomTextMapper.prototype.getPageRoot = function() {
      return this._rootNode;
    };

    DomTextMapper.prototype._getPageIndexForPos = function() {
      return 0;
    };

    DomTextMapper.prototype.isPageMapped = function() {
      return true;
    };

    DomTextMapper.prototype._getIgnoredParts = function() {
      if (this._options.getIgnoredParts) {
        if (this._ignoredParts && this._options.cacheIgnoredParts) {
          return this._ignoredParts;
        } else {
          return this._ignoredParts = this._options.getIgnoredParts();
        }
      } else {
        return [];
      }
    };

    DomTextMapper.prototype._isIrrelevant = function(node) {
      var _ref;
      return node.nodeType === Node.ELEMENT_NODE && ((_ref = node.tagName.toLowerCase()) === "canvas" || _ref === "script");
    };

    DomTextMapper.prototype._isIgnored = function(node, ignoreIrrelevant, debug) {
      var container, _i, _len, _ref;
      if (ignoreIrrelevant == null) {
        ignoreIrrelevant = false;
      }
      if (debug == null) {
        debug = false;
      }
      if (!this._pathStartNode.contains(node)) {
        if (debug) {
          this._log("Node", node, "is ignored, because it's not a descendant of", this._pathStartNode, ".");
        }
        return true;
      }
      _ref = this._getIgnoredParts();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        container = _ref[_i];
        if (container.contains(node)) {
          if (debug) {
            this._log("Node", node, "is ignore, because it's a descendant of", container);
          }
          return true;
        }
      }
      if (ignoreIrrelevant) {
        if (this._isIrrelevant(node)) {
          if (debug) {
            this._log("Node", node, "is ignored, because it's irrelevant.");
          }
          return true;
        }
      }
      if (debug) {
        this._log("Node", node, "is NOT ignored.");
      }
      return false;
    };

    DomTextMapper.prototype._findFirstIgnoredPositionInNode = function(node) {
      var child, info, start, _i, _len, _ref;
      if (this._isIgnored(node)) {
        info = this._getStartInfoForNode(node, false);
        if (info) {
          return info.start;
        }
      }
      if (!node.hasChildNodes()) {
        return null;
      }
      _ref = node.childNodes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        start = this._findFirstIgnoredPositionInNode(child);
        if (start) {
          return start;
        }
      }
      return null;
    };

    DomTextMapper.prototype._findFirstIgnoredPosition = function() {
      this._saveSelection();
      this._ignorePos = this._findFirstIgnoredPositionInNode(this._pathStartNode);
      this._restoreSelection();
      delete this._dirty;
      return this._ignorePos;
    };

    DomTextMapper.prototype._isDirty = function() {
      var x;
      x = this._observer.takeSummaries();
      return (x != null) || this._dirty;
    };

    DomTextMapper.prototype._onMutation = function(summaries) {
      var oldCorpus,
        _this = this;
      this._dirty = true;
      oldCorpus = this._corpus;
      this._getFreshCorpus();
      if (this._corpus !== oldCorpus) {
        return setTimeout(function() {
          var event;
          event = document.createEvent("UIEvents");
          event.initUIEvent("corpusChange", true, false, window, 0);
          return _this._rootNode.dispatchEvent(event);
        });
      }
    };

    DomTextMapper.prototype._changeRootNode = function(node) {
      var _ref;
      if ((_ref = this._observer) != null) {
        _ref.disconnect();
      }
      this._observer = new MutationSummary({
        callback: this._onMutation,
        rootNode: node,
        queries: [
          {
            all: true
          }
        ]
      });
      return this._rootNode = node;
    };

    return DomTextMapper;

  })(TextMapperCore);

}).call(this);

/*
//@ sourceMappingURL=dom_text_mapper.map
*/
