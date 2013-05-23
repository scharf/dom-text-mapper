# Rudementary logging stuff

class XLogger
  ERROR = 5
  WARN = 4
  INFO = 3
  DEBUG = 2
  TRACE = 1

  constructor: (name) ->
    @name = name
    @level = INFO

  currentTimestamp: -> new Date().getTime()

  elapsedTime: -> @currentTimestamp() - window.loggerStartTime

  time: -> "[" + @elapsedTime() + " ms]"

  log: (level, message) ->
    if level >= @level
      console.log @time() + " '" + @name + "': " + message

  error: (message) -> this.log ERROR, message
  warn: (message) -> this.log WARN, message
  info: (message) -> this.log INFO, message
  debug: (message) -> this.log DEBUG, message
  trace: (message) -> this.log TRACE, message

window.loggerStartTime = new Date().getTime()

window.getXLogger ?= (name) -> new XLogger(name)