// Generated by CoffeeScript 1.6.3
(function() {
  var SubTreeCollection,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __slice = [].slice,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  SubTreeCollection = (function() {
    function SubTreeCollection() {
      this.roots = [];
    }

    SubTreeCollection.prototype.add = function(node) {
      var i, newRoots, root, _i, _j, _len, _len1, _ref, _ref1, _ref2;
      _ref = this.roots;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        root = _ref[_i];
        if (root.contains(node)) {
          return;
        }
      }
      newRoots = this.roots.slice();
      _ref1 = this.roots;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        root = _ref1[_j];
        if (node.contains(root)) {
          i = newRoots.indexOf(this);
          [].splice.apply(newRoots, [i, i - i + 1].concat(_ref2 = [])), _ref2;
        }
      }
      newRoots.push(node);
      return this.roots = newRoots;
    };

    return SubTreeCollection;

  })();

  window.DomTextMapper = (function() {
    var CONTEXT_LEN, SELECT_CHILDREN_INSTEAD, USE_EMPTY_TEXT_WORKAROUND, USE_TABLE_TEXT_WORKAROUND, WHITESPACE;

    DomTextMapper.applicable = function() {
      return true;
    };

    USE_TABLE_TEXT_WORKAROUND = true;

    USE_EMPTY_TEXT_WORKAROUND = true;

    SELECT_CHILDREN_INSTEAD = ["thead", "tbody", "ol", "a", "caption", "p", "span", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "li", "form"];

    CONTEXT_LEN = 32;

    DomTextMapper.instances = 0;

    function DomTextMapper(options) {
      var _ref;
      this.options = options != null ? options : {};
      this._onMutation = __bind(this._onMutation, this);
      this._onChange = __bind(this._onChange, this);
      this.id = (_ref = this.options.id) != null ? _ref : "d-t-m #" + DomTextMapper.instances;
      if (this.options.rootNode != null) {
        this.setRootNode(this.options.rootNode);
      } else {
        this.setRealRoot();
      }
      DomTextMapper.instances += 1;
    }

    DomTextMapper.prototype.log = function() {
      var msg;
      msg = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return console.log.apply(console, [this.id, ": "].concat(__slice.call(msg)));
    };

    DomTextMapper.prototype.setRootNode = function(rootNode) {
      this.rootWin = window;
      return this.pathStartNode = this._changeRootNode(rootNode);
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
      this.rootWin = iframe.contentWindow;
      if (this.rootWin == null) {
        throw new Error("Can't access contents of the specified iframe!");
      }
      this._changeRootNode(this.rootWin.document);
      return this.pathStartNode = this.getBody();
    };

    DomTextMapper.prototype.getDefaultPath = function() {
      return this.getPathTo(this.pathStartNode);
    };

    DomTextMapper.prototype.setRealRoot = function() {
      this.rootWin = window;
      this._changeRootNode(document);
      return this.pathStartNode = this.getBody();
    };

    DomTextMapper.prototype.setExpectedContent = function(content) {
      return this.expectedContent = content;
    };

    DomTextMapper.prototype.scan = function(reason) {
      var node, path, startTime, t1, t2;
      if (reason == null) {
        reason = "unknown reason";
      }
      if (this.path != null) {
        this._syncState(reason);
        return;
      }
      if (!this.pathStartNode.ownerDocument.body.contains(this.pathStartNode)) {
        return;
      }
      this.log("Starting scan, because", reason);
      this.observer.takeSummaries();
      startTime = this.timestamp();
      this.saveSelection();
      this.path = {};
      this.traverseSubTree(this.pathStartNode, this.getDefaultPath());
      t1 = this.timestamp();
      path = this.getPathTo(this.pathStartNode);
      node = this.path[path].node;
      this.collectPositions(node, path, null, 0, 0);
      this._corpus = this.getNodeContent(this.path[path].node, false);
      this.restoreSelection();
      t2 = this.timestamp();
      this.log("Scan took", t2 - startTime, "ms.");
      return null;
    };

    DomTextMapper.prototype.selectPath = function(path, scroll) {
      var info, node;
      if (scroll == null) {
        scroll = false;
      }
      this.scan("selectPath('" + path + "')");
      info = this.path[path];
      if (info == null) {
        throw new Error("I have no info about a node at " + path);
      }
      node = info != null ? info.node : void 0;
      node || (node = this.lookUpNode(info.path));
      return this.selectNode(node, scroll);
    };

    DomTextMapper.prototype._performUpdateOnNode = function(node, reason) {
      var content, corpusChanged, data, oldContent, oldEnd, oldIndex, oldStart, p, parentPath, parentPathInfo, path, pathInfo, pathsToDrop, predecessor, predecessorInfo, predecessorPath, prefix, startTime, _i, _len;
      if (reason == null) {
        reason = "(no reason)";
      }
      if (!node) {
        throw new Error("Called performUpdate with a null node!");
      }
      if (!this.path) {
        return;
      }
      path = this.getPathTo(node);
      pathInfo = this.path[path];
      while (!pathInfo) {
        this.log("We don't have any data about the node @", this.path, ". Moving up.");
        node = node.parentNode;
        path = this.getPathTo(node);
        pathInfo = this.path[path];
      }
      startTime = this.timestamp();
      this.saveSelection();
      oldContent = pathInfo.content;
      content = this.getNodeContent(node, false);
      corpusChanged = oldContent !== content;
      prefix = path + "/";
      pathsToDrop = (function() {
        var _ref, _results;
        _ref = this.path;
        _results = [];
        for (p in _ref) {
          data = _ref[p];
          if (this.stringStartsWith(p, prefix)) {
            _results.push(p);
          }
        }
        return _results;
      }).call(this);
      if (corpusChanged) {
        pathsToDrop.push(path);
        oldStart = pathInfo.start;
        oldEnd = pathInfo.end;
      }
      for (_i = 0, _len = pathsToDrop.length; _i < _len; _i++) {
        p = pathsToDrop[_i];
        delete this.path[p];
      }
      if (corpusChanged) {
        this._alterAncestorsMappingData(node, path, oldStart, oldEnd, content);
        this._alterSiblingsMappingData(node, oldStart, oldEnd, content);
      }
      this.traverseSubTree(node, path);
      if (node === this.pathStartNode) {
        this.log("Ended up rescanning the whole doc.");
        this.collectPositions(node, path, null, 0, 0);
      } else {
        parentPath = this._parentPath(path);
        parentPathInfo = this.path[parentPath];
        oldIndex = (function() {
          if (node === node.parentNode.firstChild) {
            return 0;
          } else {
            predecessor = node.previousSibling;
            predecessorPath = this.getPathTo(predecessor);
            predecessorInfo = this.path[predecessorPath];
            if (!predecessorInfo) {
              throw new Error("While working on updating '" + path + "', I was trying to look up info about the previous sibling @ '" + predecessorPath + "', but we have none!");
            }
            return this.path[this.getPathTo(node.previousSibling)].end - parentPathInfo.start;
          }
        }).call(this);
        this.collectPositions(node, path, parentPathInfo.content, parentPathInfo.start, oldIndex);
      }
      this.restoreSelection();
      return corpusChanged;
    };

    DomTextMapper.prototype._alterAncestorsMappingData = function(node, path, oldStart, oldEnd, newContent) {
      var content, lengthDelta, opEnd, opStart, pContent, pEnd, pStart, parentPath, parentPathInfo, prefix, suffix;
      lengthDelta = newContent.length - (oldEnd - oldStart);
      if (node === this.pathStartNode) {
        this._corpus = (function() {
          if (this.expectedContent != null) {
            return this.expectedContent;
          } else {
            if (!this.path[path]) {
              console.log("We are @ path", path, "but we can't find info about it.");
              console.log(this.path);
              throw new Error("Internal error");
            }
            content = this.path[path].content;
            if (this._ignorePos != null) {
              this._ignorePos += lengthDelta;
              if (this._ignorePos) {
                return content.slice(0, this._ignorePos);
              } else {
                return "";
              }
            } else {
              return content;
            }
          }
        }).call(this);
        return;
      }
      parentPath = this._parentPath(path);
      parentPathInfo = this.path[parentPath];
      opStart = parentPathInfo.start;
      opEnd = parentPathInfo.end;
      pStart = oldStart - opStart;
      pEnd = oldEnd - opStart;
      pContent = parentPathInfo.content;
      prefix = pContent.slice(0, pStart);
      suffix = pContent.slice(pEnd);
      parentPathInfo.content = newContent = prefix + newContent + suffix;
      parentPathInfo.length += lengthDelta;
      parentPathInfo.end += lengthDelta;
      return this._alterAncestorsMappingData(parentPathInfo.node, parentPath, opStart, opEnd, newContent);
    };

    DomTextMapper.prototype._alterSiblingsMappingData = function(node, oldStart, oldEnd, newContent) {
      var delta, info, p, _ref, _results;
      delta = newContent.length - (oldEnd - oldStart);
      if (!delta) {
        return;
      }
      _ref = this.path;
      _results = [];
      for (p in _ref) {
        info = _ref[p];
        if (!(info.start >= oldEnd)) {
          continue;
        }
        info.start += delta;
        _results.push(info.end += delta);
      }
      return _results;
    };

    DomTextMapper.prototype.getInfoForPath = function(path) {
      var result;
      this.scan("getInfoForPath('" + path + "')");
      result = this.path[path];
      if (result == null) {
        throw new Error("Found no info for path '" + path + "'!");
      }
      return result;
    };

    DomTextMapper.prototype.getInfoForNode = function(node) {
      if (node == null) {
        throw new Error("Called getInfoForNode(node) with null node!");
      }
      return this.getInfoForPath(this.getPathTo(node));
    };

    DomTextMapper.prototype.getMappingsForCharRanges = function(charRanges) {
      var charRange, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = charRanges.length; _i < _len; _i++) {
        charRange = charRanges[_i];
        _results.push(this.getMappingsForCharRange(charRange.start, charRange.end));
      }
      return _results;
    };

    DomTextMapper.prototype.getContentForPath = function(path) {
      if (path == null) {
        path = null;
      }
      if (path == null) {
        path = this.getDefaultPath();
      }
      this.scan("getContentForPath('" + path + "')");
      return this.path[path].content;
    };

    DomTextMapper.prototype.getLengthForPath = function(path) {
      if (path == null) {
        path = null;
      }
      if (path == null) {
        path = this.getDefaultPath();
      }
      this.cvan("getLengthForPath('" + path + "')");
      return this.path[path].length;
    };

    DomTextMapper.prototype.getDocLength = function() {
      this.scan("getDocLength()");
      return this._corpus.length;
    };

    DomTextMapper.prototype.getCorpus = function() {
      this.scan("getCorpus()");
      return this._corpus;
    };

    DomTextMapper.prototype.getContextForCharRange = function(start, end) {
      var prefix, prefixStart, suffix;
      if (start < 0) {
        throw Error("Negative range start is invalid!");
      }
      if (end > this._corpus.length) {
        throw Error("Range end is after the end of corpus!");
      }
      this.scan("getContextForCharRange(" + start + ", " + end + ")");
      prefixStart = Math.max(0, start - CONTEXT_LEN);
      prefix = this._corpus.slice(prefixStart, start);
      suffix = this._corpus.slice(end, end + CONTEXT_LEN);
      return [prefix.trim(), suffix.trim()];
    };

    DomTextMapper.prototype.getMappingsForCharRange = function(start, end) {
      var endInfo, endMapping, endNode, endOffset, endPath, info, mappings, p, r, result, startInfo, startMapping, startNode, startOffset, startPath, _ref,
        _this = this;
      if (!((start != null) && (end != null))) {
        throw new Error("start and end is required!");
      }
      this.scan("getMappingsForCharRange(" + start + ", " + end + ")");
      mappings = [];
      _ref = this.path;
      for (p in _ref) {
        info = _ref[p];
        if (info.atomic && this._regions_overlap(info.start, info.end, start, end)) {
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
                _this.computeSourcePositions(mapping);
                mapping.yields = info.node.data.substr(mapping.startCorrected, mapping.endCorrected - mapping.startCorrected);
              } else if ((info.node.nodeType === Node.ELEMENT_NODE) && (info.node.tagName.toLowerCase() === "img")) {
                _this.log("Can not select a sub-string from the title of an image. Selecting all.");
                mapping.full = true;
                mapping.wanted = info.content;
              } else {
                _this.log("Warning: no idea how to handle partial mappings for node type " + info.node.nodeType);
                if (info.node.tagName != null) {
                  _this.log("Tag: " + info.node.tagName);
                }
                _this.log("Selecting all.");
                mapping.full = true;
                mapping.wanted = info.content;
              }
            }
            return mappings.push(mapping);
          })(info);
        }
      }
      if (mappings.length === 0) {
        this.log("Collecting nodes for [" + start + ":" + end + "]");
        this.log("Should be: '" + this._corpus.slice(start, end) + "'.");
        throw new Error("No mappings found for [" + start + ":" + end + "]!");
      }
      mappings = mappings.sort(function(a, b) {
        return a.element.start - b.element.start;
      });
      r = this.rootWin.document.createRange();
      startMapping = mappings[0];
      startNode = startMapping.element.node;
      startPath = startMapping.element.path;
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
      endPath = endMapping.element.path;
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

    DomTextMapper.prototype.timestamp = function() {
      return new Date().getTime();
    };

    DomTextMapper.prototype.stringStartsWith = function(string, prefix) {
      if (!prefix) {
        throw Error("Requires a non-empty prefix!");
      }
      return string.slice(0, prefix.length) === prefix;
    };

    DomTextMapper.prototype.stringEndsWith = function(string, suffix) {
      if (!suffix) {
        throw Error("Requires a non-empty suffix!");
      }
      return string.slice(string.length - suffix.length, string.length) === suffix;
    };

    DomTextMapper.prototype._parentPath = function(path) {
      return path.substr(0, path.lastIndexOf("/"));
    };

    DomTextMapper.prototype.getProperNodeName = function(node) {
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

    DomTextMapper.prototype.getNodePosition = function(node) {
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

    DomTextMapper.prototype.getPathSegment = function(node) {
      var name, pos;
      name = this.getProperNodeName(node);
      pos = this.getNodePosition(node);
      return name + (pos > 1 ? "[" + pos + "]" : "");
    };

    DomTextMapper.prototype.getPathTo = function(node) {
      var origNode, xpath;
      if (!(origNode = node)) {
        throw new Error("Called getPathTo with null node!");
      }
      xpath = '';
      while (node !== this.rootNode) {
        if (node == null) {
          this.log("Root node:", this.rootNode);
          this.log("Wanted node:", origNode);
          throw new Error("Called getPathTo on a node which was not a descendant of the configured root node.");
        }
        xpath = (this.getPathSegment(node)) + '/' + xpath;
        node = node.parentNode;
      }
      xpath = (this.rootNode.ownerDocument != null ? './' : '/') + xpath;
      xpath = xpath.replace(/\/$/, '');
      return xpath;
    };

    DomTextMapper.prototype.traverseSubTree = function(node, path, invisible, verbose) {
      var child, cont, subpath, _i, _len, _ref;
      if (invisible == null) {
        invisible = false;
      }
      if (verbose == null) {
        verbose = false;
      }
      if (this._isIgnored(node)) {
        return;
      }
      this.underTraverse = path;
      cont = this.getNodeContent(node, false);
      this.path[path] = {
        path: path,
        content: cont,
        length: cont.length,
        node: node
      };
      if (cont.length) {
        if (verbose) {
          this.log("Collected info about path " + path);
        }
        if (invisible) {
          this.log("Something seems to be wrong. I see visible content @ " + path + ", while some of the ancestor nodes reported empty contents. Probably a new selection API bug....");
          this.log("Anyway, text is '" + cont + "'.");
        }
      } else {
        if (verbose) {
          this.log("Found no content at path " + path);
        }
        invisible = true;
      }
      if (node.hasChildNodes()) {
        _ref = node.childNodes;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          subpath = path + '/' + (this.getPathSegment(child));
          this.traverseSubTree(child, subpath, invisible, verbose);
        }
      }
      return null;
    };

    DomTextMapper.prototype.getBody = function() {
      return (this.rootWin.document.getElementsByTagName("body"))[0];
    };

    DomTextMapper.prototype._regions_overlap = function(start1, end1, start2, end2) {
      return start1 < end2 && start2 < end1;
    };

    DomTextMapper.prototype.lookUpNode = function(path) {
      var doc, node, results, _ref;
      doc = (_ref = this.rootNode.ownerDocument) != null ? _ref : this.rootNode;
      results = doc.evaluate(path, this.rootNode, null, 0, null);
      return node = results.iterateNext();
    };

    DomTextMapper.prototype.saveSelection = function() {
      var i, sel;
      if (this.savedSelection != null) {
        this.log("Selection saved at:");
        this.log(this.selectionSaved);
        throw new Error("Selection already saved!");
      }
      sel = this.rootWin.getSelection();
      this.savedSelection = (function() {
        var _i, _ref, _results;
        _results = [];
        for (i = _i = 0, _ref = sel.rangeCount; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
          _results.push(sel.getRangeAt(i));
        }
        return _results;
      })();
      return this.selectionSaved = (new Error("selection was saved here")).stack;
    };

    DomTextMapper.prototype.restoreSelection = function() {
      var range, sel, _i, _len, _ref;
      if (this.savedSelection == null) {
        throw new Error("No selection to restore.");
      }
      sel = this.rootWin.getSelection();
      sel.removeAllRanges();
      _ref = this.savedSelection;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        range = _ref[_i];
        sel.addRange(range);
      }
      return delete this.savedSelection;
    };

    DomTextMapper.prototype.selectNode = function(node, scroll) {
      var children, exception, realRange, sel, sn, _ref;
      if (scroll == null) {
        scroll = false;
      }
      if (node == null) {
        throw new Error("Called selectNode with null node!");
      }
      sel = this.rootWin.getSelection();
      sel.removeAllRanges();
      realRange = this.rootWin.document.createRange();
      if (node.nodeType === Node.ELEMENT_NODE && node.hasChildNodes() && (_ref = node.tagName.toLowerCase(), __indexOf.call(SELECT_CHILDREN_INSTEAD, _ref) >= 0)) {
        children = node.childNodes;
        realRange.setStartBefore(children[0]);
        realRange.setEndAfter(children[children.length - 1]);
        sel.addRange(realRange);
      } else {
        if (USE_TABLE_TEXT_WORKAROUND && node.nodeType === Node.TEXT_NODE && node.parentNode.tagName.toLowerCase() === "table") {

        } else {
          try {
            realRange.setStartBefore(node);
            realRange.setEndAfter(node);
            sel.addRange(realRange);
          } catch (_error) {
            exception = _error;
            if (!(USE_EMPTY_TEXT_WORKAROUND && this.isWhitespace(node))) {
              this.log("Warning: failed to scan element @ " + this.underTraverse);
              this.log("Content is: " + node.innerHTML);
              this.log("We won't be able to properly anchor to any text inside this element.");
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
          this.log("Failed to scroll to element. (Browser does not support scrollIntoViewIfNeeded?)");
        }
      }
      return sel;
    };

    DomTextMapper.prototype.readSelectionText = function(sel) {
      sel || (sel = this.rootWin.getSelection());
      return sel.toString().trim().replace(/\n/g, " ").replace(/\s{2,}/g, " ");
    };

    DomTextMapper.prototype.getNodeSelectionText = function(node, shouldRestoreSelection) {
      var sel, text;
      if (shouldRestoreSelection == null) {
        shouldRestoreSelection = true;
      }
      if (shouldRestoreSelection) {
        this.saveSelection();
      }
      sel = this.selectNode(node);
      text = this.readSelectionText(sel);
      if (shouldRestoreSelection) {
        this.restoreSelection();
      }
      return text;
    };

    DomTextMapper.prototype.computeSourcePositions = function(match) {
      var dc, displayEnd, displayIndex, displayStart, displayText, sc, sourceEnd, sourceIndex, sourceStart, sourceText;
      sourceText = match.element.node.data.replace(/\n/g, " ");
      displayText = match.element.content;
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

    DomTextMapper.prototype.getNodeContent = function(node, shouldRestoreSelection) {
      var content;
      if (shouldRestoreSelection == null) {
        shouldRestoreSelection = true;
      }
      if ((node === this.pathStartNode) && (this.expectedContent != null)) {
        return this.expectedContent;
      }
      content = this.getNodeSelectionText(node, shouldRestoreSelection);
      if ((node === this.pathStartNode) && (this._ignorePos != null)) {
        return content.slice(0, this._ignorePos);
      }
      return content;
    };

    DomTextMapper.prototype.collectPositions = function(node, path, parentContent, parentIndex, index) {
      var atomic, child, childPath, children, content, endIndex, i, newCount, nodeName, oldCount, pathInfo, pos, startIndex, typeCount;
      if (parentContent == null) {
        parentContent = null;
      }
      if (parentIndex == null) {
        parentIndex = 0;
      }
      if (index == null) {
        index = 0;
      }
      if (this._isIgnored(node)) {
        pos = parentIndex + index;
        if (!((this._ignorePos != null) && this._ignorePos < pos)) {
          this._ignorePos = pos;
        }
        return index;
      }
      pathInfo = this.path[path];
      content = pathInfo != null ? pathInfo.content : void 0;
      if (!content) {
        pathInfo.start = parentIndex + index;
        pathInfo.end = parentIndex + index;
        pathInfo.atomic = false;
        return index;
      }
      startIndex = parentContent != null ? parentContent.indexOf(content, index) : index;
      if (startIndex === -1) {
        return index;
      }
      endIndex = startIndex + content.length;
      atomic = !node.hasChildNodes();
      pathInfo.start = parentIndex + startIndex;
      pathInfo.end = parentIndex + endIndex;
      pathInfo.atomic = atomic;
      if (!atomic) {
        children = node.childNodes;
        i = 0;
        pos = 0;
        typeCount = Object();
        while (i < children.length) {
          child = children[i];
          nodeName = this.getProperNodeName(child);
          oldCount = typeCount[nodeName];
          newCount = oldCount != null ? oldCount + 1 : 1;
          typeCount[nodeName] = newCount;
          childPath = path + "/" + nodeName + (newCount > 1 ? "[" + newCount + "]" : "");
          pos = this.collectPositions(child, childPath, content, parentIndex + startIndex, pos);
          i++;
        }
      }
      return endIndex;
    };

    WHITESPACE = /^\s*$/;

    DomTextMapper.prototype.isWhitespace = function(node) {
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
              mightBeEmpty = mightBeEmpty && this.isWhitespace(child);
            }
            return mightBeEmpty;
          default:
            return false;
        }
      }).call(this);
      return result;
    };

    DomTextMapper.prototype._testNodeMapping = function(path, info) {
      var inCorpus, ok1, ok2, realContent;
      if (info == null) {
        info = this.path[path];
      }
      if (!info) {
        throw new Error("Could not look up node @ '" + path + "'!");
      }
      inCorpus = info.end ? this._corpus.slice(info.start, info.end) : "";
      realContent = this.getNodeContent(info.node);
      ok1 = info.content === inCorpus;
      if (!ok1) {
        this.log("Mismatch on ", path, ": stored content is", "'" + info.content + "'", ", range in corpus is", "'" + inCorpus + "'");
      }
      ok2 = info.content === realContent;
      if (!ok2) {
        this.log("Mismatch on ", path, ": stored content is '", info.content, "', actual content is '", realContent, "'.");
      }
      return [ok1, ok2];
    };

    DomTextMapper.prototype._testAllMappings = function() {
      var i, info, p, path, _ref, _ref1, _results;
      this.log("Verifying map info: was it all properly traversed?");
      _ref = this.path;
      for (i in _ref) {
        p = _ref[i];
        if (p.atomic == null) {
          this.log(i, "is missing data.");
        }
      }
      this.log("Verifying map info: do nodes match?");
      _ref1 = this.path;
      _results = [];
      for (path in _ref1) {
        info = _ref1[path];
        _results.push(this._testNodeMapping(path, info));
      }
      return _results;
    };

    DomTextMapper.prototype.getPageIndex = function() {
      return 0;
    };

    DomTextMapper.prototype.getPageCount = function() {
      return 1;
    };

    DomTextMapper.prototype.getPageRoot = function() {
      return this.rootNode;
    };

    DomTextMapper.prototype.getPageIndexForPos = function() {
      return 0;
    };

    DomTextMapper.prototype.isPageMapped = function() {
      return true;
    };

    DomTextMapper.prototype._getIgnoredParts = function() {
      if (this.options.getIgnoredParts) {
        if (this._ignoredParts && this.options.cacheIgnoredParts) {
          return this._ignoredParts;
        } else {
          return this._ignoredParts = this.options.getIgnoredParts();
        }
      } else {
        return [];
      }
    };

    DomTextMapper.prototype._isIgnored = function(node) {
      var container, _i, _len, _ref;
      _ref = this._getIgnoredParts();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        container = _ref[_i];
        if (container.contains(node)) {
          return true;
        }
      }
      return false;
    };

    DomTextMapper.prototype._isAttributeChangeImportant = function(node, attributeName, oldValue, newValue) {
      if (this.options.filterAttributeChanges) {
        return this.options.filterAttributeChanges(node, attributeName, oldValue, newValue);
      } else {
        return true;
      }
    };

    DomTextMapper.prototype._filterChanges = function(changes) {
      var attrName, attributeChanged, attributeChangedCount, elementList, k, list, removed, v, _ref, _ref1, _ref2,
        _this = this;
      if (this._getIgnoredParts().length === 0) {
        return changes;
      }
      changes.added = changes.added.filter(function(element) {
        return !_this._isIgnored(element);
      });
      removed = changes.removed;
      changes.removed = removed.filter(function(element) {
        var parent;
        parent = element;
        while (__indexOf.call(removed, parent) >= 0) {
          parent = changes.getOldParentNode(parent);
        }
        return !_this._isIgnored(parent);
      });
      attributeChanged = {};
      _ref1 = (_ref = changes.attributeChanged) != null ? _ref : {};
      for (attrName in _ref1) {
        elementList = _ref1[attrName];
        list = elementList.filter(function(element) {
          return !_this._isIgnored(element);
        });
        list = list.filter(function(element) {
          return _this._isAttributeChangeImportant(element, attrName, changes.getOldAttribute(element, attrName), element.getAttribute(attrName));
        });
        if (list.length) {
          attributeChanged[attrName] = list;
        }
      }
      changes.attributeChanged = attributeChanged;
      changes.characterDataChanged = changes.characterDataChanged.filter(function(element) {
        return !_this._isIgnored(element);
      });
      changes.reordered = changes.reordered.filter(function(element) {
        var parent;
        parent = element.parentNode;
        return !_this._isIgnored(parent);
      });
      attributeChangedCount = 0;
      _ref2 = changes.attributeChanged;
      for (k in _ref2) {
        v = _ref2[k];
        attributeChangedCount++;
      }
      if (changes.added.length || changes.characterDataChanged.length || changes.removed.length || changes.reordered.length || changes.reparented.length || attributeChangedCount) {
        return changes;
      } else {
        return null;
      }
      return changes;
    };

    DomTextMapper.prototype._getInvolvedNodes = function(changes) {
      var k, list, n, parent, trees, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
      trees = new SubTreeCollection();
      _ref = changes.added;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        n = _ref[_i];
        trees.add(n.parentNode);
      }
      _ref1 = changes.attributeChanged;
      for (k in _ref1) {
        list = _ref1[k];
        for (_j = 0, _len1 = list.length; _j < _len1; _j++) {
          n = list[_j];
          trees.add(n);
        }
      }
      _ref2 = changes.characterDataChanged;
      for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
        n = _ref2[_k];
        trees.add(n);
      }
      _ref3 = changes.removed;
      for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
        n = _ref3[_l];
        parent = n;
        while ((__indexOf.call(changes.removed, parent) >= 0) || (__indexOf.call(changes.reparented, parent) >= 0)) {
          parent = changes.getOldParentNode(parent);
        }
        trees.add(parent);
      }
      _ref4 = changes.reordered;
      for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
        n = _ref4[_m];
        trees.add(n.parentNode);
      }
      _ref5 = changes.reparented;
      for (_n = 0, _len5 = _ref5.length; _n < _len5; _n++) {
        n = _ref5[_n];
        trees.add(n.parentNode);
        parent = n;
        while ((__indexOf.call(changes.removed, parent) >= 0) || (__indexOf.call(changes.reparented, parent) >= 0)) {
          parent = changes.getOldParentNode(parent);
        }
        trees.add(parent);
      }
      return trees.roots;
    };

    DomTextMapper.prototype._reactToChanges = function(reason, changes, data) {
      var changedNodes, corpusChanged, node, _i, _len,
        _this = this;
      if (changes) {
        changes = this._filterChanges(changes);
      }
      if (!changes) {
        return;
      }
      changedNodes = this._getInvolvedNodes(changes);
      corpusChanged = false;
      for (_i = 0, _len = changedNodes.length; _i < _len; _i++) {
        node = changedNodes[_i];
        if (this._performUpdateOnNode(node, reason, false, data)) {
          corpusChanged = true;
        }
      }
      if (corpusChanged) {
        return setTimeout(function() {
          var event;
          event = document.createEvent("UIEvents");
          event.initUIEvent("corpusChange", true, false, window, 0);
          return _this.rootNode.dispatchEvent(event);
        });
      }
    };

    DomTextMapper.prototype._syncState = function(reason, data) {
      var summaries;
      if (reason == null) {
        reason = "i am in the mood";
      }
      summaries = this.observer.takeSummaries();
      return this._reactToChanges("SyncState for " + reason, summaries != null ? summaries[0] : void 0, data);
    };

    DomTextMapper.prototype._onChange = function(event) {
      return this._syncState("change event '" + event.reason + "'", event.data);
    };

    DomTextMapper.prototype._onMutation = function(summaries) {
      return this._reactToChanges("Observer called", summaries[0]);
    };

    DomTextMapper.prototype._changeRootNode = function(node) {
      var _ref;
      if ((_ref = this.observer) != null) {
        _ref.disconnect();
      }
      this.rootNode = node;
      this.observer = new MutationSummary({
        callback: this._onMutation,
        rootNode: node,
        queries: [
          {
            all: true
          }
        ]
      });
      return node;
    };

    return DomTextMapper;

  })();

}).call(this);

/*
//@ sourceMappingURL=dom_text_mapper.map
*/
