// JS Library
var $ = function(a) {return document.querySelector(a);};
var $$ = function(a) {return document.querySelectorAll(a);};

this.Element && function(ElementPrototype) {
	ElementPrototype.matchesSelector = ElementPrototype.matchesSelector || 
	    ElementPrototype.mozMatchesSelector ||
	    ElementPrototype.msMatchesSelector ||
	    ElementPrototype.oMatchesSelector ||
	    ElementPrototype.webkitMatchesSelector ||
	    function (selector) {
            var i = -1;
            var root = this.parentNode || this.document;
            var nodes = root.querySelectorAll(selector);
            while (nodes[++i] && nodes[i] != this);
            return !!nodes[i];
        };
}(Element.prototype);

var listen = function(selector, event, cbk) {
    document.addEventListener(event, function(e) {
        if (e.target.matchesSelector(selector)) {
            cbk(e);
        }
    });
};

// Feature Code
listen("label[for]", "touchend", function(e) {
    var toCheck = $("#" + e.target.attributes["for"].value + "[type='radio']");
    if (toCheck) {
        toCheck.checked = true;
    }
});
