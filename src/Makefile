default: compile

clean:
	rm -f *.js *.map

compile: clean
	coffee -m -c dom_text_mapper.coffee
	coffee -m -c xlog.coffee

uglify: compile
	uglifyjs xlog.js -c -m > xlog.min.js
	uglifyjs dom_text_mapper.js -c -m > dom_text_mapper.min.js

