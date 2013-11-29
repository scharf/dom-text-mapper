// Generated by CoffeeScript 1.6.3
(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  window.PDFTextMapper = (function(_super) {
    __extends(PDFTextMapper, _super);

    PDFTextMapper.applicable = function() {
      var _ref;
      return (_ref = typeof PDFView !== "undefined" && PDFView !== null ? PDFView.initialized : void 0) != null ? _ref : false;
    };

    PDFTextMapper.prototype.requiresSmartStringPadding = true;

    PDFTextMapper.prototype.getPageCount = function() {
      return PDFView.pages.length;
    };

    PDFTextMapper.prototype.getPageIndex = function() {
      return PDFView.page - 1;
    };

    PDFTextMapper.prototype.setPageIndex = function(index) {
      return PDFView.page = index + 1;
    };

    PDFTextMapper.prototype._isPageRendered = function(index) {
      var _ref, _ref1;
      return (_ref = PDFView.pages[index]) != null ? (_ref1 = _ref.textLayer) != null ? _ref1.renderingDone : void 0 : void 0;
    };

    PDFTextMapper.prototype.getRootNodeForPage = function(index) {
      return PDFView.pages[index].textLayer.textLayerDiv;
    };

    function PDFTextMapper() {
      this._parseExtractedText = __bind(this._parseExtractedText, this);
      this.setEvents();
      PDFTextMapper.__super__.constructor.apply(this, arguments);
    }

    PDFTextMapper.prototype.setEvents = function() {
      var _this = this;
      addEventListener("pagerender", function(evt) {
        var index;
        if (_this.pageInfo == null) {
          return;
        }
        index = evt.detail.pageNumber - 1;
        return _this._onPageRendered(index);
      });
      addEventListener("DOMNodeRemoved", function(evt) {
        var index, node;
        node = evt.target;
        if (node.nodeType === Node.ELEMENT_NODE && node.nodeName.toLowerCase() === "div" && node.className === "textLayer") {
          index = parseInt(node.parentNode.id.substr(13) - 1);
          return _this._unmapPage(_this.pageInfo[index]);
        }
      });
      return $(PDFView.container).on('scroll', function() {
        return _this._onScroll();
      });
    };

    PDFTextMapper.prototype._extractionPattern = /[ ]+/g;

    PDFTextMapper.prototype._parseExtractedText = function(text) {
      return text.replace(this._extractionPattern, " ");
    };

    PDFTextMapper.prototype._startScan = function(reason) {
      var _this = this;
      if (this._pendingScan) {
        return;
      }
      this._pendingScan = true;
      if (this.pageInfo) {
        return this._readyAllPages(reason, function() {
          return _this._scanFinished();
        });
      } else {
        return this._startPDFTextExtraction(reason);
      }
    };

    PDFTextMapper.prototype._startPDFTextExtraction = function(reason) {
      var _this = this;
      if (PDFView.pdfDocument == null) {
        setTimeout((function() {
          return _this._startScan(reason);
        }), 500);
        return;
      }
      return PDFView.getPage(1).then(function() {
        console.log("Scanning PDF document for text, because", reason);
        _this.pageInfo = [];
        return _this._extractPDFPageText(0);
      });
    };

    PDFTextMapper.prototype.prepare = function(reason) {
      var promise;
      promise = new PDFJS.Promise();
      this.ready(reason, function(s) {
        return promise.resolve(s);
      });
      return promise;
    };

    PDFTextMapper.prototype._extractPDFPageText = function(pageIndex) {
      var page,
        _this = this;
      page = PDFFindController.pdfPageSource.pages[pageIndex];
      return page.getTextContent().then(function(data) {
        var content, rawContent, text;
        rawContent = ((function() {
          var _i, _len, _ref, _results;
          _ref = data.bidiTexts;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            text = _ref[_i];
            _results.push(text.str);
          }
          return _results;
        })()).join(" ");
        content = _this._parseExtractedText(rawContent);
        _this.pageInfo[pageIndex] = {
          content: content
        };
        if (pageIndex === PDFView.pages.length - 1) {
          _this._onHavePageContents();
          _this._scanFinished();
          return _this._onAfterTextExtraction();
        } else {
          return _this._extractPDFPageText(pageIndex + 1);
        }
      });
    };

    PDFTextMapper.prototype._getPageForNode = function(node) {
      var div, index;
      div = node;
      while ((div.nodeType !== Node.ELEMENT_NODE) || (div.getAttribute("class") == null) || (div.getAttribute("class") !== "textLayer")) {
        div = div.parentNode;
      }
      index = parseInt(div.parentNode.id.substr(13) - 1);
      return this.pageInfo[index];
    };

    return PDFTextMapper;

  })(window.PageTextMapperCore);

}).call(this);

/*
//@ sourceMappingURL=pdf_text_mapper.map
*/
