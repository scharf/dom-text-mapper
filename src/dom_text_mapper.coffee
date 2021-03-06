class window.DomTextMapper extends TextMapperCore

  @applicable: -> true

  USE_TABLE_TEXT_WORKAROUND = true
  USE_EMPTY_TEXT_WORKAROUND = true
  SELECT_CHILDREN_INSTEAD = ["table", "thead", "tbody", "tfoot", "ol", "a", "caption", "p", "span", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "li", "form"]

  WATCHED_PATHS = [
#    "."
#    "./DIV[3]"
    "./DIV[3]/DIV[5]/DIV[2]"
    "./DIV[3]/DIV[5]/DIV[2]/DIV[2]"
  ]

  @instances: 0

  constructor: (@_options = {})->
    super(@_options.id ? "d-t-m #" + DomTextMapper.instances)
    if @_options.rootNode?
      @setRootNode @_options.rootNode
    else
      @setRealRoot()
    DomTextMapper.instances += 1

  # ===== Public methods =======

  # Consider only the sub-tree beginning with the given node.
  # 
  # This will be the root node to use for all operations.
  setRootNode: (rootNode) ->
    @_rootWin = window
    @_pathStartNode = @_changeRootNode rootNode

  # Consider only the sub-tree beginning with the node whose ID was given.
  # 
  # This will be the root node to use for all operations.
  setRootId: (rootId) -> @setRootNode document.getElementById rootId

  # Use this iframe for operations.
  #
  # Call this when mapping content in an iframe.
  setRootIframe: (iframeId) ->
    iframe = window.document.getElementById iframeId
    unless iframe?
      throw new Error "Can't find iframe with specified ID!"
    @_rootWin = iframe.contentWindow
    unless @_rootWin?
      throw new Error "Can't access contents of the specified iframe!"
    @_changeRootNode @_rootWin.document
    @_pathStartNode = @_getBody()

  # Work with the whole DOM tree
  # 
  # (This is the default; you only need to call this, if you have configured
  # a different root earlier, and now you want to restore the default setting.)
  setRealRoot: ->
    @_rootWin = window
    @_changeRootNode document
    @_pathStartNode = @_getBody() 

  setExpectedContent: (content) ->
    @_expectedContent = content

  # Select the given path (for visual identification),
  # and optionally scroll to it
  _selectPath: (path, scroll = false) ->
    node = @_lookUpNode path
    @_selectNode node, scroll

  # Get the matching DOM elements for a given charRange
  #
  # If the "path" argument is supplied, scan is called automatically.
  # (Except if the supplied path is the same as the last scanned path.)
  _getMappingsForCharRange: (start, end) =>
    unless (start? and end?)
      throw new Error "start and end is required!"

    #@_log "Collecting nodes for [" + start + ":" + end + "]"

    # Collect all the text nodes
    nodes = @_collectAllTextNodes()

    # Now search for the start position

    @_saveSelection()                         # Save the original selection
    origCorpus = @_getFreshCorpus false, true # Save the original corpus

    pcs = {}
    index = 0
    for node in nodes
      origText = node.nodeValue             # Save the original text
      continue unless origText.length

      # Check the start
      origChar = origText[0]                # Get the first character
      # Choose a replacement character
      changedChar = if origChar is "." then "," else "."
      changedText = changedChar + origText.substring(1) # Calculate new text
      node.nodeValue = changedText          # Actually change the text
      changedCorpus = @_getFreshCorpus false, true# Check the current corpus
      startIndex = @_getDiffIndex origCorpus, changedCorpus # Find the spot

      # Check the end
      origChar = origText[origText.length-1]  # Get the first character
      # Choose a replacement
      changedChar = if origChar is "." then "," else "."
      changedText = origText.substr(0, origText.length - 1) + changedChar
      node.nodeValue = changedText         # Actually change the text
      changedCorpus = @_getFreshCorpus false, true  # Check the current corpus
      endIndex = 1 + @_getDiffIndex origCorpus, changedCorpus # Find the spot

      # Restore orignal concent
      node.nodeValue = origText             # Restore the original content

      # Skip if empty
      continue if endIndex is startIndex + 1

      # Looks like this is a real text node
      pcs[++index] =
        start: startIndex
        end: endIndex
        node: node
        content: origCorpus[ startIndex ... endIndex ]

    @_restoreSelection()

    # Collect the matching nodes
    #@_log "Collecting mappings"
    mappings = []
    for i, info of pcs when @_regions_overlap info.start, info.end, start, end
      do (info) =>
#        @_log "Checking " + info.path
#        @_log info
        mapping =
          element: info

        full = start <= info.start and info.end <= end
        if full
          mapping.full = true
          mapping.wanted = info.content
          mapping.yields = info.content
          mapping.startCorrected = 0
          mapping.endCorrected = 0
        else
          if info.node.nodeType is Node.TEXT_NODE        
            if start <= info.start
              mapping.end = end - info.start
              mapping.wanted = info.content.substr 0, mapping.end
            else if info.end <= end
              mapping.start = start - info.start
              mapping.wanted = info.content.substr mapping.start        
            else
              mapping.start = start - info.start
              mapping.end = end - info.start
              mapping.wanted = info.content.substr mapping.start,
                  mapping.end - mapping.start

            @_computeSourcePositions mapping
            mapping.yields = info.node.data.substr mapping.startCorrected,
                mapping.endCorrected - mapping.startCorrected
          else if (info.node.nodeType is Node.ELEMENT_NODE) and
              (info.node.tagName.toLowerCase() is "img")
            @_log "Can not select a sub-string from the title of an image.
 Selecting all."
            mapping.full = true
            mapping.wanted = info.content
          else
            @_log "Warning: no idea how to handle partial mappings
 for node type " + info.node.nodeType
            if info.node.tagName? then @_log "Tag: " + info.node.tagName
            @_log "Selecting all."
            mapping.full = true
            mapping.wanted = info.content

        mappings.push mapping
#        @_log "Done with " + info.path

    if mappings.length is 0
      @_log "Collecting nodes for [" + start + ":" + end + "]"
      @_log "Should be: '" + @_corpus[ start ... end ] + "'."
      throw new Error "No mappings found for [" + start + ":" + end + "]!"

    mappings = mappings.sort (a, b) -> a.element.start - b.element.start
        
    # Create a DOM range object
#    @_log "Building range..."
    r = @_rootWin.document.createRange()
    startMapping = mappings[0]
    startNode = startMapping.element.node
    startPath = startMapping.element.path = @_getPathTo startNode
    startOffset = startMapping.startCorrected
    if startMapping.full
      r.setStartBefore startNode
      startInfo = startPath
    else
      r.setStart startNode, startOffset
      startInfo = startPath + ":" + startOffset

    endMapping = mappings[mappings.length - 1]
    endNode = endMapping.element.node
    endPath = endMapping.element.path = @_getPathTo endNode
    endOffset = endMapping.endCorrected
    if endMapping.full
      r.setEndAfter endNode
      endInfo = endPath
    else
      r.setEnd endNode, endOffset
      endInfo = endPath + ":" + endOffset

    result = {
      mappings: mappings
      realRange: r
      rangeInfo:
        startPath: startPath
        startOffset: startOffset
        startInfo: startInfo
        endPath: endPath
        endOffset: endOffset
        endInfo: endInfo
      safeParent: r.commonAncestorContainer
    }

    # Return the result
    sections: [result]

  # Call this fnction to wait for any pending operations
  ready: (reason, callback) ->
    unless callback?
      throw new Error "missing callback!"
    @_pendingCallbacks ?= []
    @_pendingCallbacks.push callback
    @_startScan reason
    null

  # ===== Private methods (never call from outside the module) =======

  _startScan: =>
    @_getFreshCorpus()
    @_scanFinished()

  # Update the corpus
  _getFreshCorpus: (shouldRestoreSelection = true,
      intermittent = false) ->
    #@_log "Recalculating corpus."

    newCorpus = @_getNodeContent @_pathStartNode, shouldRestoreSelection

    # If this is an intermittent check, just return
    return newCorpus if intermittent

    # Let's see if there is a part which we should ignore

    # We only want to do this (costy) calculation if there was a change
    if @_isDirty()
      @_ignorePos = @_findFirstIgnoredPosition()

    if @_ignorePos?
      newCorpus = newCorpus[ ... @_ignorePos ]

    @_corpus = newCorpus.trim()

  # Find the first text node inside a given node
  _findFirstTextNode: (node) ->
    # If this is a text node, we have the solution
    return node if node.nodeType is Node.TEXT_NODE

    # No children, no solution
    return null unless node.hasChildNodes()

    # Go over the children
    for child in node.childNodes
      result = @_findFirstTextNode child
      return result if result

    # None of the children actually contained a text node.
    null

  # Find the last text node inside a given node 
  _findLastTextNode: (node) ->
    # If this is a text node, we have the solution
    return node if node.nodeType is Node.TEXT_NODE

    # No children, no solution
    return null unless node.hasChildNodes()

    # Go over the children
    for child in node.childNodes.reverse()
      result = @_findLastTextNode child
      return result if result

    # None of the children actually contained a text node.
    null

  # Compare two strings, and returns the index of the first difference
  _getDiffIndex: (string1, string2) ->
#    unless string1.length is string2.length
#      console.log "String 1: '" + string1 + "'"
#      console.log "String 2: '" + string2 + "'"
#      throw new Error "Whoah, the lengths are different!"

    result = -1
    for i in [0 ... string1.length]
      unless string1[i] is string2[i]
        result = i
        break
    result


  # Helper function for position calculating
  _calculatePositionIndex(node, isStart, shouldRestoreSelection = true) =>
    text = if isStart
      @_findFirstTextNode node    # Get the first text node
    else
      @_findLastTextNode node       # Get the last text node
    return null unless text            # Return if there is no text node
    origText = text.nodeValue          # Save the original text
    return null unless origText.length      # Return if it's empty
    @_saveSelection() if shouldRestoreSelection # Save the original selection
    origCorpus = @_getFreshCorpus false, true # Save the original corpus
    origChar = if isStart then origText[0] else origText[origText.length-1] # Get the original character
    changedChar = if origChar is "." then "," else "." # Choose a replacement
    changedText = if isStart
      changedChar + origText.substring(1) # Calculate new text
    else
      origText.substr(0, origText.length - 1) + changedChar
    text.nodeValue = changedText   # Actually change the text
    changedCorpus = @_getFreshCorpus false, true  # Check the current corpus
    index = @_getDiffIndex origCorpus, changedCorpus # Find the difference
    text.nodeValue = origText          # Restore the original content
    @_restoreSelection() if shouldRestoreSelection # Restore the selection

    return null if index is -1              # No difference -> this is hidden

    # The final result is the position of the difference in corpus
    res =
      page: 0
    if isStart then res.start = index else res.end = index + 1
    res

  # Calculates the starting position of a given node
  _getStartInfoForNode: (node, shouldRestoreSelection) =>
    _calculatePositionIndex node, true, shouldRestoreSelection

  # Calculates the ending position of a given node
  _getEndInfoForNode: (node, shouldRestoreSelection) =>
    _calculatePositionIndex node, false, shouldRestoreSelection

  _collectAllTextNodes: (node = null, results = []) ->
    node ?= @_pathStartNode
    switch node.nodeType
      when Node.TEXT_NODE
        results.push node
      when Node.ELEMENT_NODE
        if node.hasChildNodes()
          for n in node.childNodes
            @_collectAllTextNodes n, results
      else
        @_log "Ignoring node type", node.nodeType
    results

  _parentPath: (path) -> path.substr 0, path.lastIndexOf "/"

  _getProperNodeName: (node) ->
    nodeName = node.nodeName
    switch nodeName
      when "#text" then return "text()"
      when "#comment" then return "comment()"
      when "#cdata-section" then return "cdata-section()"
      else return nodeName

  _getNodePosition: (node) ->
    pos = 0
    tmp = node
    while tmp
      if tmp.nodeName is node.nodeName
        pos++
      tmp = tmp.previousSibling
    pos

  _getPathSegment: (node) ->
    name = @_getProperNodeName node
    pos = @_getNodePosition node
    name + (if pos > 1 then "[#{pos}]" else "")

  _getPathTo: (node) ->
    unless origNode = node
      throw new Error "Called getPathTo with null node!"
    xpath = '';
    while node != @_rootNode
      unless node?
        @_log "Root node:", @_rootNode
        @_log "Wanted node:", origNode
        @_log "Is this even a child?", @_rootNode.contains origNode
        throw new Error "Called getPathTo on a node which was not a descendant of the configured root node."
      xpath = (@_getPathSegment node) + '/' + xpath
      node = node.parentNode
    xpath = (if @_rootNode.ownerDocument? then './' else '/') + xpath
    xpath = xpath.replace /\/$/, ''
    xpath

  _getBody: -> (@_rootWin.document.getElementsByTagName "body")[0]

  _regions_overlap: (start1, end1, start2, end2) ->
      start1 < end2 and start2 < end1

  _lookUpNode: (path) ->
    doc = @_rootNode.ownerDocument ? @_rootNode
    results = doc.evaluate path, @_rootNode, null, 0, null
    node = results.iterateNext()

  # save the original selection
  _saveSelection: ->
    if @_savedSelection?
      @_log "Selection saved at:"
      @_log @_selectionSaved
      throw new Error "Selection already saved!"
    sel = @_rootWin.getSelection()
    #@_log "Saving selection: " + sel.rangeCount + " ranges."

    @_savedSelection = for i in [0 ... sel.rangeCount]
      r = sel.getRangeAt i
      range: r
      endOffset: r.endOffset

    @_selectionSaved = (new Error "selection was saved here").stack

  # restore selection
  _restoreSelection: ->
    #@_log "Restoring selection: " + @_savedSelection.length + " ranges."
    unless @_savedSelection? then throw new Error "No selection to restore."
    sel = @_rootWin.getSelection()
    sel.removeAllRanges()
    for r in @_savedSelection
      r.range.setEnd r.range.endContainer, r.endOffset
      sel.addRange r.range
    delete @_savedSelection

  # Select the given node (for visual identification),
  # and optionally scroll to it
  _selectNode: (node, scroll = false) ->
    unless node?
      throw new Error "Called selectNode with null node!"
    sel = @_rootWin.getSelection()

    # clear the selection
    sel.removeAllRanges()

    # create our range, and select it
    realRange = @_rootWin.document.createRange()

    # There is some weird, bogus behaviour in Chrome,
    # triggered by whitespaces between the table tag and it's children.
    # See the select-tbody and the select-the-parent-when-selecting problems
    # described here:
    #    https://github.com/hypothesis/h/issues/280
    # And the WebKit bug report here:
    #    https://bugs.webkit.org/show_bug.cgi?id=110595
    # 
    # To work around this, when told to select specific nodes, we have to
    # do various other things. See bellow.

    if node.nodeType is Node.ELEMENT_NODE and node.hasChildNodes() and
        node.tagName.toLowerCase() in SELECT_CHILDREN_INSTEAD
      # This is an element where direct selection sometimes fails,
      # because if the WebKit bug.
      # (Sometimes it selects nothing, sometimes it selects something wrong.)
      # So we select directly the children instead.
      children = node.childNodes
      realRange.setStartBefore children[0]
      realRange.setEndAfter children[children.length - 1]
      sel.addRange realRange
    else
      if USE_TABLE_TEXT_WORKAROUND and node.nodeType is Node.TEXT_NODE and
          @_isWhitespace node
        # This is a text element that should not even be here.
        # Selecting it might select the whole table,
        # so we don't select anything
      else
        # Normal element, should be selected
        try
          realRange.setStartBefore node
          realRange.setEndAfter node
          sel.addRange realRange
        catch exception
          # This might be caused by the fact that FF can't select a
          # TextNode containing only whitespace.
          # If this is the case, then it's OK.
          unless USE_EMPTY_TEXT_WORKAROUND and @_isWhitespace node
            # No, this is not the case. Then this is an error.
            @_log "Warning: failed to scan element @ " + @underTraverse
            @_log "Content is: " + node.innerHTML
            @_log "We won't be able to properly anchor to any text inside this element."
#            throw exception
    if scroll
      sn = node
      while sn? and not sn.scrollIntoViewIfNeeded?
        sn = sn.parentNode
      if sn?
        sn.scrollIntoViewIfNeeded()
      else
        @_log "Failed to scroll to element. (Browser does not support scrollIntoViewIfNeeded?)"
    sel

  # Read and convert the text of the current selection.
  _readSelectionText: (sel) ->
    sel or= @_rootWin.getSelection()
    sel.toString().trim().replace(/\n/g, " ").replace /\s{2,}/g, " "

  # Read the "text content" of a sub-tree of the DOM by
  # creating a selection from it
  _getNodeSelectionText: (node, shouldRestoreSelection = true) ->
    if shouldRestoreSelection then @_saveSelection()

    sel = @_selectNode node
    text = @_readSelectionText sel

    if shouldRestoreSelection then @_restoreSelection()
    text


  # Convert "display" text indices to "source" text indices.
  _computeSourcePositions: (match) ->
#    @_log "In computeSourcePosition",
#      match.element.path,
#      match.element.node.data

    # the HTML source of the text inside a text element.
#    @_log "Calculating source position at " + match.element.path
    sourceText = match.element.node.data.replace /[\s\xA0]/g, " "
#    @log "sourceText is '" + sourceText + "'"

    # what gets displayed, when the node is processed by the browser.
    displayText = match.element.content.replace /[\s\xA0]/g, " "
#    @_log "displayText is '" + displayText + "'"

    if displayText.length > sourceText.length
      throw new Error "Invalid match at" + match.element.path + ": sourceText is '" + sourceText + "'," +
        " displayText is '" + displayText + "'."

    # The selected charRange in displayText.
    displayStart = if match.start? then match.start else 0
    displayEnd = if match.end? then match.end else displayText.length
#    @_log "Display charRange is: " + displayStart + "-" + displayEnd

    if displayEnd is 0
      # Handle empty text nodes  
      match.startCorrected = 0
      match.endCorrected = 0
#      @_log "This is empty. Returning"
      return

    sourceIndex = 0
    displayIndex = 0

    until sourceStart? and sourceEnd?
      sc = sourceText[sourceIndex]
      dc = displayText[displayIndex]
      if sc is dc
        if displayIndex is displayStart
          sourceStart = sourceIndex
        displayIndex++        
        if displayIndex is displayEnd
          sourceEnd = sourceIndex + 1

      sourceIndex++
    match.startCorrected = sourceStart
    match.endCorrected = sourceEnd
#    @_log "computeSourcePosition done. Corrected charRange is: ",
#      match.startCorrected + "-" + match.endCorrected
    null

  # Internal function used to read out the text content of a given node,
  # as render by the browser.
  # The current implementation uses the browser selection API to do so.
  _getNodeContent: (node, shouldRestoreSelection = true) ->
    content = @_getNodeSelectionText node, shouldRestoreSelection
    if (node is @_pathStartNode) and @_expectedContent?
#      @_log "Returning fake expectedContent for getNodeContent"
      @_log "I should find out how to make actual content fit the expectations"

      # TODO: do a smarter mapping here, which can handle char changes.
      content = @_expectedContent

    # Return the content
    content

  WHITESPACE = /^\s*$/

  # Decides whether a given node is a text node that only contains whitespace
  _isWhitespace: (node) ->
    result = switch node.nodeType
      when Node.TEXT_NODE
        WHITESPACE.test node.data
      when Node.ELEMENT_NODE
        mightBeEmpty = true
        for child in node.childNodes
          mightBeEmpty = mightBeEmpty and @_isWhitespace child
        mightBeEmpty
      else false
    result

  # Fake two-phase / pagination support, used for HTML documents
  getPageIndex: -> 0
  getPageCount: -> 1
  getPageRoot: -> @_rootNode
  _getPageIndexForPos: -> 0
  isPageMapped: -> true

  # Change tracking ===================

  # Get the list of nodes that should be totally ignored
  _getIgnoredParts: ->
   # Do we have to ignore some parts?
    if @_options.getIgnoredParts # Yes, some parts should be ignored.
      # Do we already have them, and are we allowed to cache?
      if @_ignoredParts and @_options.cacheIgnoredParts # Yes, in cache
        @_ignoredParts
      else # No cache (yet?). Get a new list!
        @_ignoredParts = @_options.getIgnoredParts()
    else # Not ignoring anything; facing reality as it is
      []

  # Irrelevant nodes are nodes that are guaranteed not to content any valid
  # text. Usually, we don't need to care about them.
  _isIrrelevant: (node) ->
    node.nodeType is Node.ELEMENT_NODE and
      node.tagName.toLowerCase() in ["canvas", "script"]

  # Determines whether a node should be ignored
  # This can be caused by either being part of a sub-tree which is ignored,
  # or being irrelevant by nature, if this option is allowed.
  _isIgnored: (node, ignoreIrrelevant = false, debug = false) ->
    # Don't bother with totally removed nodes
    unless @_pathStartNode.contains node
      if debug
        @_log "Node", node, "is ignored, because it's not a descendant of",
          @_pathStartNode, "."
      return true

    for container in @_getIgnoredParts()
      if container.contains node
        if debug
          @_log "Node", node, "is ignore, because it's a descendant of",
            container
        return true

    # Should we ignore irrelevant nodes here?
    if ignoreIrrelevant
      if @_isIrrelevant node
        if debug
          @_log "Node", node, "is ignored, because it's irrelevant."
        return true

    # OK, we have found no excuse to ignore this node.
    if debug
      @_log "Node", node, "is NOT ignored."
    false


  # Find out the position of the first node inside
  # the given node which is supposed to be ignored
  _findFirstIgnoredPositionInNode: (node) ->
    # Is this node ignored?
    if @_isIgnored node
      info = @_getStartInfoForNode node, false
      if info
        return info.start

    # If the node itself is not ignored, let's check the children
    return null unless node.hasChildNodes()

    for child in node.childNodes
      start = @_findFirstIgnoredPositionInNode child
      return start if start

    # Nothing found
    null


  # Find out the position of the first node on the page which is supposed
  # to be ignored
  _findFirstIgnoredPosition: ->

#    return @_ignorePos if @_ignorePos?

    @_saveSelection()
    @_ignorePos = @_findFirstIgnoredPositionInNode @_pathStartNode
    @_restoreSelection()

    delete @_dirty
    @_ignorePos

  # Are there any unreported changes in the DOM?
  _isDirty: ->
    x = @_observer.takeSummaries()
    x? or @_dirty

  # Callback for the mutation observer
  _onMutation: (summaries) =>
    @_dirty = true

    oldCorpus = @_corpus
    @_getFreshCorpus()

    # If there was a corpus change, announce it
    if @_corpus isnt oldCorpus then setTimeout =>
#      @_log "CORPUS HAS CHANGED"
      event = document.createEvent "UIEvents"
      event.initUIEvent "corpusChange", true, false, window, 0
      @_rootNode.dispatchEvent event

  # Change the root node, and subscribe to the events
  _changeRootNode: (node) ->
    @_observer?.disconnect()
    @_observer = new MutationSummary
      callback: @_onMutation
      rootNode: node
      queries: [ all: true ]
    @_rootNode = node
