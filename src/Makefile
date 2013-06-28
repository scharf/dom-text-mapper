default: compile

clean:
	rm -f *.js *.map

compile: clean
	coffee -m -c dom_text_mapper.coffee

uglify: compile
	uglifyjs dom_text_mapper.js -c -m > dom_text_mapper.min.js

