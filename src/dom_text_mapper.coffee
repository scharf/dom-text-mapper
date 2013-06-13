class window.DomTextMapper

  USE_TABLE_TEXT_WORKAROUND = true
  USE_EMPTY_TEXT_WORKAROUND = true
  SELECT_CHILDREN_INSTEAD = ["thead", "tbody", "ol", "a", "caption", "p"]
  CONTEXT_LEN = 32
  SCAN_JOB_LENGTH_MS = 100

  @instances: []
  @log = getXLogger ("DomTextMapper class")

  @changed: (node, reason = "no reason") ->
    if @instances.length is 0 then return
    dm = @instances[0]
    @log.debug "Node @ " + (dm.getPathTo node) + " has changed: " + reason
    for instance in @instances when instance.rootNode.contains(node)
      instance.performSyncUpdateOnNode node
    null

  constructor: (name) ->
    @log = getXLogger (name ? "dom-text-mapper")
    @setRealRoot()
    DomTextMapper.instances.push this

  # ===== Public methods =======

  # Consider only the sub-tree beginning with the given node.
  # 
  # This will be the root node to use for all operations.
  setRootNode: (rootNode) ->
    @rootWin = window     
    @pathStartNode = @rootNode = rootNode

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
    @rootWin = iframe.contentWindow
    unless @rootWin?
      throw new Error "Can't access contents of the specified iframe!"
    @rootNode = @rootWin.document
    @pathStartNode = @getBody()

  # Return the default path
  getDefaultPath: -> @getPathTo @pathStartNode

  # Work with the whole DOM tree
  # 
  # (This is the default; you only need to call this, if you have configured
  # a different root earlier, and now you want to restore the default setting.)
  setRealRoot: ->
    @rootWin = window    
    @rootNode = document
    @pathStartNode = @getBody() 

  # Notify the library that the document has changed.
  # This means that subsequent calls can not safely re-use previously cached
  # data structures, so some calculations will be necessary again.
  #
  # The usage of this feature is not mandatorry; if not receiving change
  # notifications, the library will just assume that the document can change
  # anythime, and therefore will not assume any stability.
  documentChanged: ->
    @lastDOMChange = @timestamp()
    @log.debug "Registered document change."

  # Scan the document - Sync version
  #
  # Traverses the DOM, collects various information, and
  # creates mappings between the string indices
  # (as appearing in the rendered text) and the DOM elements.  
  # 
  # An map is returned, where the keys are the paths, and the
  # values are objects with info about those parts of the DOM.
  #   path: the valid path value
  #   node: reference to the DOM node
  #   content: the text content of the node, as rendered by the browser
  #   length: the length of the next content
  scanSync: ->
    if @domStableSince @lastScanned
      # We have a valid paths structure!
      @log.debug "We have a valid DOM structure cache. Not scanning."
      return @path

    unless @pathStartNode.ownerDocument.body.contains @pathStartNode
      @log.debug "We cannot map nodes that are not attached."
      return @path

    @log.debug "No valid cache, will have to do a scan."
    @documentChanged()

    startTime = @timestamp()
    @path = {}
    pathStart = @getDefaultPath()
    task = node: @pathStartNode, path: pathStart
    @saveSelection()
    @finishTraverseSync task
    @restoreSelection()
    t1 = @timestamp()
    @log.info "Phase I (Path traversal) took " + (t1 - startTime) + " ms."

    node = @path[pathStart].node
    @collectPositions node, pathStart, null, 0, 0
    @lastScanned = @timestamp()
    @corpus = @path[pathStart].content

    t2 = @timestamp()    
    @log.info "Phase II (offset calculation) took " + (t2 - t1) + " ms."

    @path

    null

  # Scan the document - sync version
  #
  # Traverses the DOM, collects various information, and
  # creates mappings between the string indices
  # (as appearing in the rendered text) and the DOM elements.  
  # 
  # An map is returned, where the keys are the paths, and the
  # values are objects with info about those parts of the DOM.
  #   path: the valid path value
  #   node: reference to the DOM node
  #   content: the text content of the node, as rendered by the browser
  #   length: the length of the next content
  scanAsync: (onProgress, onFinished) ->
    if @domStableSince @lastScanned
      # We have a valid paths structure!
      @log.debug "We have a valid DOM structure cache. Not scanning."
      onFinished @path

    @log.debug "No valid cache, will have to do a scan."
    @documentChanged()

    startTime = @timestamp()
    @path = {}
    pathStart = @getDefaultPath()
    task = node: @pathStartNode, path: pathStart
    @finishTraverseAsync task, onProgress, =>
#      t1 = @timestamp()
#      @log.info "Phase I (Path traversal) took " + (t1 - startTime) + " ms."

      node = @path[pathStart].node
      @collectPositions node, pathStart, null, 0, 0
      @lastScanned = @timestamp()
      @corpus = @path[pathStart].content
#      @log.trace "Corpus is: " + @corpus

#      t2 = @timestamp()    
#      @log.info "Phase II (offset calculation) took " + (t2 - t1) + " ms."

      onFinished @path

    null

  # Select the given path (for visual identification),
  # and optionally scroll to it
  selectPath: (path, scroll = false) ->
    info = @path[path]
    unless info? then throw new Error "I have no info about a node at " + path
    node = info?.node
    node or= @lookUpNode info.path
    @selectNode node, scroll
 
  performSyncUpdateOnNode: (node, escalating = false) ->
    unless node?
      throw new Error "Called performSyncUpdateOnOde with a null node!"
    unless @path? then return #We don't have data yet. Not updating.
    startTime = @timestamp()
    unless escalating then @saveSelection()
    path = @getPathTo node
    pathInfo = @path[path]
    unless pathInfo?
      # This node seems to be have changed.
      # Scan the parten instead.
      @performSyncUpdateOnNode node.parentNode, true
      unless escalating then @restoreSelection()        
      return

    @log.debug "Performing update on node @ path " + path

    if escalating then @log.debug "(Escalated)"
    @log.trace "Updating data about " + path + ": "
    if pathInfo.node is node and pathInfo.content is @getNodeContent node, false
      @log.trace "Good, the node and the overall content is still the same"
      @log.trace "Dropping obsolete path info for children..."
      prefix = path + "/"
      pathsToDrop =p

      # FIXME: There must be a more elegant way to do this. 
      pathsToDrop = []
      for p, data of @path when @stringStartsWith p, prefix
        pathsToDrop.push p
      for p in pathsToDrop
        delete @path[p]        

      task = path:path, node: node
      @finishTraverseSync task

      @log.trace "Done. Collecting new path info..."

      if pathInfo.node is @pathStartNode
        @log.debug "Ended up rescanning the whole doc."
        @collectPositions node, path, null, 0, 0
      else
        parentPath = @parentPath path
        parentPathInfo = @path[parentPath]
        unless parentPathInfo?
          throw new Error "While performing update on node " + path +
             ", no path info found for parent path: " + parentPath
        oldIndex = if node is node.parentNode.firstChild
          0
        else
          prevSiblingPathInfo = @path[@getPathTo node.previousSibling]
          prevSiblingPathInfo.end - parentPathInfo.start
        @collectPositions node, path, parentPathInfo.content,
            parentPathInfo.start, oldIndex
        
      @log.debug "Data update took " + (@timestamp() - startTime) + " ms."

    else
      @log.trace "Hm..node has been replaced, or overall content has changed!"
      if pathInfo.node isnt @pathStartNode
        @log.trace "I guess I must go up one level."
        parentNode = if node.parentNode?
          @log.trace "Node has parent, using that."
          node.parentNode
        else
          parentPath = @parentPath path
          @log.trace "Node has no parent, will look up " + parentPath
          @lookUpNode parentPath
        @performSyncUpdateOnNode parentNode, true
      else
        throw new Error "Can not keep up with the changes,
 since even the node configured as path start node was replaced."
    unless escalating then @restoreSelection()        

  # Return info for a given path in the DOM
  getInfoForPath: (path) ->
    unless @path?
      throw new Error "Can't get info before running a scan() !"
    result = @path[path]
    unless result?
      throw new Error "Found no info for path '" + path + "'!"
    result

  # Return info for a given node in the DOM
  getInfoForNode: (node) ->
    unless node?
      throw new Error "Called getInfoForNode(node) with null node!"
    @getInfoForPath @getPathTo node

  # Get the matching DOM elements for a given set of charRanges
  # (Calles getMappingsForCharRange for each element in the givenl ist)
  getMappingsForCharRanges: (charRanges) ->
    log.debug "Getting mappings for charRanges:"
    log.debug charRanges
    (for charRange in charRanges
      mapping = @getMappingsForCharRange charRange.start, charRange.end
    )

  # Return the rendered value of a part of the dom.
  # If path is not given, the default path is used.
  getContentForPath: (path = null) -> 
    path ?= @getDefaultPath()       
    @path[path].content

  # Return the length of the rendered value of a part of the dom.
  # If path is not given, the default path is used.
  getLengthForPath: (path = null) ->
    path ?= @getDefaultPath()
    @path[path].length

  getDocLength: -> @getLengthForPath()

  # Return a given charRange of the rendered value of a part of the dom.
  # If path is not given, the default path is used.
  getContentForCharRange: (start, end, path = null) ->
    text = @getContentForPath(path).substr start, end - start
    text.trim()

  # Get the context that encompasses the given charRange
  # in the rendered text of the document
  getContextForCharRange: (start, end, path = null) ->
    content = @getContentForPath path
    prefixStart = Math.max 0, start - CONTEXT_LEN
    prefixLen = start - prefixStart
    prefix = content.substr prefixStart, prefixLen
    suffix = content.substr end, prefixLen
    [prefix.trim(), suffix.trim()]
        
  # Get the matching DOM elements for a given charRange
  # 
  # If the "path" argument is supplied, scan is called automatically.
  # (Except if the supplied path is the same as the last scanned path.)
  getMappingsForCharRange: (start, end) ->
    unless (start? and end?)
      throw new Error "start and end is required!"
    @log.trace "Collecting nodes for [" + start + ":" + end + "]"

    unless @domStableSince @lastScanned
      throw new Error "Can not get mappings, since the dom has changed since last scanned. Call scan first."

    @log.trace "Collecting mappings"
    mappings = []
    for p, info of @path when info.atomic and
        @regions_overlap info.start, info.end, start, end
      do (info) =>
        @log.trace "Checking " + info.path
        @log.trace info
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
     
            @computeSourcePositions mapping
            mapping.yields = info.node.data.substr mapping.startCorrected,
                mapping.endCorrected - mapping.startCorrected
          else if (info.node.nodeType is Node.ELEMENT_NODE) and
              (info.node.tagName.toLowerCase() is "img")
            @log.debug "Can not select a sub-string from the title of an image.
 Selecting all."
            mapping.full = true
            mapping.wanted = info.content
          else
            @log.warn "Warning: no idea how to handle partial mappings for node type " + info.node.nodeType
            if info.node.tagName? then @log.warn "Tag: " + info.node.tagName
            @log.warn "Selecting all."
            mapping.full = true
            mapping.wanted = info.content

        mappings.push mapping
        @log.trace "Done with " + info.path

    if mappings.length is 0
      throw new Error "No mappings found for [" + start + ":" + end + "]!"

    mappings = mappings.sort (a, b) -> a.element.start - b.element.star
t

    # Create a DOM range object
    @log.trace "Building range..."
    r = @rootWin.document.createRange()
    startMapping = mappings[0]
    startNode = startMapping.element.node
    startPath = startMapping.element.path
    startOffset = startMapping.startCorrected
    if startMapping.full
      r.setStartBefore startNode
      startInfo = startPath
    else
      r.setStart startNode, startOffset
      startInfo = startPath + ":" + startOffset

    endMapping = mappings[mappings.length - 1]
    endNode = endMapping.element.node
    endPath = endMapping.element.path
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
    @log.trace "Done collecting"
    result

  # ===== Private methods (never call from outside the module) =======

  timestamp: -> new Date().getTime()

  stringStartsWith: (string, prefix) ->
    prefix is string.substr 0, prefix.length

  stringEndsWith: (string, suffix) ->
    suffix is string.substr string.length - suffix.length

  parentPath: (path) -> path.substr 0, path.lastIndexOf "/"

  domChangedSince: (timestamp) ->
    if @lastDOMChange? and timestamp? then @lastDOMChange > timestamp else true

  domStableSince: (timestamp) -> not @domChangedSince timestamp

  getProperNodeName: (node) ->
    nodeName = node.nodeName
    switch nodeName
      when "#text" then return "text()"
      when "#comment" then return "comment()"
      when "#cdata-section" then return "cdata-section()"
      else return nodeName

  getNodePosition: (node) ->
    pos = 0
    tmp = node
    while tmp
      if tmp.nodeName is node.nodeName
        pos++
      tmp = tmp.previousSibling
    pos

  getPathSegment: (node) ->
    name = @getProperNodeName node
    pos = @getNodePosition node
    name + (if pos > 1 then "[#{pos}]" else "")

  getPathTo: (node) ->
    xpath = '';
    while node != @rootNode
      unless node?
        throw new Error "Called getPathTo on a node which was not a descendant of @rootNode. " + @rootNode
      xpath = (@getPathSegment node) + '/' + xpath
      node = node.parentNode
    xpath = (if @rootNode.ownerDocument? then './' else '/') + xpath
    xpath = xpath.replace /\/$/, ''
    xpath

  # Execute a DOM node traverse task. This involves collecting onformation
  # about a node, and generating further tasks for it's child nodes.
  executeTraverseTask: (task) ->
    node = task.node
    @underTraverse = path = task.path
    invisiable = task.invisible ? false
    verbose  = task.verbose ? false
    @log.trace "Executing traverse task for path " + path

    # Step one: get rendered node content, and store path info,
    # if there is valuable content
    cont = @getNodeContent node, false
    @path[path] =
      path: path
      content: cont
      length: cont.length
      node: node
    if cont.length
      if verbose
        @log.info "Collected info about path " + path
      else
        @log.trace "Collected info about path " + path
      if invisible
        @log.warn "Something seems to be wrong. I see visible content @ " +
            path + ", while some of the ancestor nodes reported empty contents." +
            " Probably a new selection API bug...."
        
    else
      if verbose
        @log.info "Found no content at path " + path
      else
        @log.trace "Found no content at path " + path
      invisible = true

    # Step two: cover all children.
    # Q: should we check children even if
    # the given node had no rendered content?
    # A: I seem to remember that the answer is yes, but I don't remember why.

    if node.hasChildNodes()
      for child in node.childNodes
        @traverseTasks.push
          node: child
          path: path + '/' + (@getPathSegment child) 
          invisible: invisible
          verbose: verbose
    null


  # Run a round of DOM traverse tasks, and schedule the next one
  runTraverseRounds: ->
    try
      @saveSelection()
      roundStart = @timestamp()
      tasksDone = 0
      while @traverseTasks.length and (@timestamp() - roundStart < SCAN_JOB_LENGTH_MS)
        @log.trace "Queue length is: " + @traverseTasks.length
        task = @traverseTasks.pop()
        @executeTraverseTask task
        tasksDone += 1
        # for leaf nodes,        
        unless task.node.hasChildNodes()
          # count the chars we have covered
          @traverseCoveredChars += @path[task.path].length

        @log.trace "Round covered " + tasksDone + " tasks " +
          "in " + (@timestamp() - roundStart) + " ms." +
          " Covered chars: " + @traverseCoveredChars

      @restoreSelection()
      if @traverseOnProgress?
        progress = @traverseCoveredChars / @traverseTotalLength        
        @traverseOnProgress progress

      # Is there still more work to do?
      if @traverseTasks.length
        # OK, scheduling next round
        window.setTimeout => @runTraverseRounds()
      else
        # We are ready!
        @traverseOnFinished()
    catch exception
      @log.error "Internal error while traversing", exception

  # Execute an full DOM traverse compaign,
  # starting with the given task.
  finishTraverseSync: (rootTask) ->
    if @traverseTasks? and @traverseTasks.size
      throw new Error "A DOM traverse is already in progress!"
    @traverseTasks = []
    @executeTraverseTask rootTask

    @traverseTotalLength = @path[rootTask.path].length
    @traverseCoveredChars = 0

    while @traverseTasks.length
      @executeTraverseTask @traverseTasks.pop()

  # Execute an full DOM traverse compaign,
  # starting with the given task.
  finishTraverseAsync: (rootTask, onProgress, onFinished) ->
    if @traverseTasks? and @traverseTasks.size
      throw new Error "A DOM traverse is already in progress!"
    @traverseTasks = []
    @saveSelection()
    @executeTraverseTask rootTask
    @restoreSelection()
    @traverseTotalLength = @path[rootTask.path].length
    @traverseOnProgress = onProgress
    @traverseCoveredChars = 0
    @traverseOnFinished = onFinished

    # Schedule first round
    window.setTimeout => @runTraverseRounds()


  getBody: -> (@rootWin.document.getElementsByTagName "body")[0]

  regions_overlap: (start1, end1, start2, end2) ->
      start1 < end2 and start2 < end1

  lookUpNode: (path) ->
    doc = @rootNode.ownerDocument ? @rootNode
    results = doc.evaluate path, @rootNode, null, 0, null
    node = results.iterateNext()

  # save the original selection
  saveSelection: ->
    if @savedSelection?
      throw new Error "Selection already saved! Here:" + @selectionSaved + "\n\n" +
        "New attempt to save:"
    sel = @rootWin.getSelection()
    @log.debug "Saving selection: " + sel.rangeCount + " ranges."
    @savedSelection = (sel.getRangeAt i) for i in [0 ... sel.rangeCount]
    switch sel.rangeCount
      when 0 then @savedSelection ?= []
      when 1 then @savedSelection = [ @savedSelection ]
    @selectionSaved = (new Error "").stack

  # restore selection
  restoreSelection: ->
    @log.trace "Restoring selection: " + @savedSelection.length + " ranges."
    unless @savedSelection? then throw new Error "No selection to restore."
    sel = @rootWin.getSelection()
    sel.removeAllRanges()
    sel.addRange range for range in @savedSelection
    delete @savedSelection

  # Select the given node (for visual identification),
  # and optionally scroll to it
  selectNode: (node, scroll = false) ->
    unless node?
      throw new Error "Called selectNode with null node!"
    sel = @rootWin.getSelection()

    # clear the selection
    sel.removeAllRanges()

    # create our range, and select it
    realRange = @rootWin.document.createRange()

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
          node.parentNode.tagName.toLowerCase() is "table"
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
          unless USE_EMPTY_TEXT_WORKAROUND and @isWhitespace node
            # No, this is not the case. Then this is an error.
            @log.warn "Warning: failed to scan element @ " + @underTraverse
            @log.warn "Content is: " + node.innerHTML
            @log.warn "We won't be able to properly anchor to any text inside this element."
    if scroll
      sn = node
      while sn? and not sn.scrollIntoViewIfNeeded?
        sn = sn.parentNode
      if sn?
        sn.scrollIntoViewIfNeeded()
      else
        @log.warn "Failed to scroll to element. (Browser does not support scrollIntoViewIfNeeded?)"
    sel

  # Read and convert the text of the current selection.
  readSelectionText: (sel) ->
    sel or= @rootWin.getSelection()
    sel.toString().trim().replace(/\n/g, " ").replace /\s{2,}/g, " "

  # Read the "text content" of a sub-tree of the DOM by
  # creating a selection from it
  getNodeSelectionText: (node, shouldRestoreSelection = true) ->
    if shouldRestoreSelection then @saveSelection()

    sel = @selectNode node
    text = @readSelectionText sel

    if shouldRestoreSelection then @restoreSelection()
    text


  # Convert "display" text indices to "source" text indices.
  computeSourcePositions: (match) ->
    @log.trace "In computeSourcePosition"
    @log.trace "Path is '" + match.element.path + "'"
    @log.trace "Node data is: ", match.element.node.data

    # the HTML source of the text inside a text element.
    sourceText = match.element.node.data.replace /\n/g, " "
    @log.trace "sourceText is '" + sourceText + "'"

    # what gets displayed, when the node is processed by the browser.
    displayText = match.element.content
    @log.trace "displayText is '" + displayText + "'"

    # The selected charRange in displayText.
    displayStart = if match.start? then match.start else 0
    displayEnd = if match.end? then match.end else displayText.length
    @log.trace "Display charRange is: " + displayStart + "-" + displayEnd

    if displayEnd is 0
      # Handle empty text nodes  
      match.startCorrected = 0
      match.endCorrected = 0
      return

    sourceIndex = 0
    displayIndex = 0

    until sourceStart? and sourceEnd?
      if sourceIndex is sourceText.length
        throw new Error "Error! This node (at '" + match.element.path + "') looks different compared to what I remember! Maybe the document was updated, but d-t-m was not notified?"
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
    @log.trace "computeSourcePosition done. Corrected charRange is: " +
      match.startCorrected + "-" + match.endCorrected
    null

  # Internal function used to read out the text content of a given node,
  # as render by the browser.
  # The current implementation uses the browser selection API to do so.
  getNodeContent: (node, shouldRestoreSelection = true) ->
    @getNodeSelectionText node, shouldRestoreSelection

  # Internal function to collect mapping data from a given DOM element.
  # 
  # Input parameters:
  #    node: the node to scan
  #    path: the path to the node (relative to rootNode
  #    parentContent: the content of the node's parent node
  #           (as rendered by the browser)
  #           This is used to determine whether the given node is rendered
  #           at all.
  #           If not given, it will be assumed that it is rendered
  #    parentIndex: the starting character offset
  #           of content of this node's parent node in the rendered content
  #    index: ths first character offset position in the content of this
  #           node's parent node
  #           where the content of this node might start
  #
  # Returns:
  #    the first character offset position in the content of this node's
  #    parent node that is not accounted for by this node
  collectPositions: (node, path, parentContent = null, parentIndex = 0, index = 0) ->
    @log.trace "Scanning path " + path
#    content = @getNodeContent node, false

    pathInfo = @path[path]
    unless pathInfo?
      @log.error "I have no info about " + path + ". This should not happen."
      @log.error "Node:"
      @log.error node
      @log.error "This probably was _not_ here last time. Expect problems."
      return index

    content = pathInfo?.content

    if not content? or content is ""
      # node has no content, not interesting
      pathInfo.start = parentIndex + index
      pathInfo.end = parentIndex + index
      pathInfo.atomic = false
      return index

    startIndex = if parentContent?
      parentContent.indexOf content, index
    else
      index
    if startIndex is -1
       # content of node is not present in parent's content - probably hidden,
       # or something similar
       @log.trace "Content of this not is not present in content of parent, " +
         "at path " + path
       return index


    endIndex = startIndex + content.length
    atomic = not node.hasChildNodes()
    pathInfo.start = parentIndex + startIndex
    pathInfo.end = parentIndex + endIndex
    pathInfo.atomic = atomic

    if not atomic
      children = node.childNodes
      i = 0
      pos = 0
      typeCount = Object()
      while i < children.length
        child = children[i]
        nodeName = @getProperNodeName child
        oldCount = typeCount[nodeName]
        newCount = if oldCount? then oldCount + 1 else 1
        typeCount[nodeName] = newCount
        childPath = path + "/" + nodeName + (if newCount > 1
          "[" + newCount + "]"
        else
          ""
        )
        pos = @collectPositions child, childPath, content,
            parentIndex + startIndex, pos
        i++

    endIndex

  WHITESPACE = /^\s*$/

  # Decides whether a given node is a text node that only contains whitespace
  isWhitespace: (node) ->
    result = switch node.nodeType
      when Node.TEXT_NODE
        WHITESPACE.test node.data
      when Node.ELEMENT_NODE
        mightBeEmpty = true
        for child in node.childNodes
          mightBeEmpty = mightBeEmpty and @isWhitespace child
        mightBeEmpty
      else false
    result
