# Rudementary logging stuff

window.XLOG_LEVEL ?=
  ERROR: 5
  WARN: 4
  INFO: 3
  DEBUG: 2
  TRACE: 1

class XLogger

  constructor: (name) ->
    @name = name
    @level = XLOG_LEVEL.INFO

  setLevel: (level) -> @level = level

  currentTimestamp: -> new Date().getTime()

  elapsedTime: -> @currentTimestamp() - window.loggerStartTime

  time: -> "[" + @elapsedTime() + " ms]"

  log: (level, message) ->
    if level >= @level
      console.log @time() + " '" + @name + "': " + message

  error: (message) -> this.log XLOG_LEVEL.ERROR, message
  warn: (message) -> this.log XLOG_LEVEL.WARN, message
  info: (message) -> this.log XLOG_LEVEL.INFO, message
  debug: (message) -> this.log XLOG_LEVEL.DEBUG, message
  trace: (message) -> this.log XLOG_LEVEL.TRACE, message

window.loggerStartTime = new Date().getTime()

window.getXLogger ?= (name) -> new XLogger(name)