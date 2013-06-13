# Rudementary logging framework
# to be used in
#  * dom-text-mapper
#  * dom-text-matcher
#  * Annotator
#  * Hypothes.is
#
# (And whatever else who finds it useful.)

window.XLOG_LEVEL =
  ERROR: 5
  WARN: 4
  INFO: 3
  DEBUG: 2
  TRACE: 1

class XLogger

  constructor: (name) ->
    @name = name
    this.setLevel XLOG_LEVEL.INFO

  setLevel: (level) ->
    unless level?
      throw new Error "Setting undefined level!"    
    @level = level

  currentTimestamp: -> new Date().getTime()

  elapsedTime: ->
    if XLoggerStartTime?
      @currentTimestamp() - XLoggerStartTime
    else
      "???"

  time: -> "[" + @elapsedTime() + " ms]"

  _log: (level, objects) ->
    if level >= @level
      time = @time()
      for obj in objects
        text = unless obj?
          "null"
        else if obj instanceof Error
          obj.stack
        else
          try
            result = JSON.stringify obj, null, 2
          catch exception # If it's circular
            console.log obj
            result = "<SEE ABOVE>" #@stringify obj
          result
        
        lines = text.split "\n"
        for line in lines
          console.log time + " '" + @name + "': " + line

  error: (objects...) -> this._log XLOG_LEVEL.ERROR, objects
  warn: (objects...) -> this._log XLOG_LEVEL.WARN, objects
  info: (objects...) -> this._log XLOG_LEVEL.INFO, objects
  debug: (objects...) -> this._log XLOG_LEVEL.DEBUG, objects
  trace: (objects...) -> this._log XLOG_LEVEL.TRACE, objects

window.XLoggerStartTime ?= new Date().getTime()

window.getXLogger ?= (name) -> new XLogger(name)
