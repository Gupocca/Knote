/* === Utility Functions === */
var util = {
    tagBody: '(?:[^"\'>]|"[^"]*"|\'[^\']*\')*',
    tagOrComment: new RegExp('<(?:!--(?:(?:-*[^->])*--+|-?)|script\\b' + this.tagBody + '>[\\s\\S]*?</script\\s*|style\\b' + this.tagBody  + '>[\\s\\S]*?</style\\s*|/?[a-z]' + this.tagBody + ')>', 'gi'),
    removeTags: function(html) {
        'use strict';
        var oldHtml;
        do {
            oldHtml = html;
            html = html.replace(this.tagOrComment, '');
        } while (html !== oldHtml);
        return html.replace(/</g, '&lt;');
    },
    showError: function(err) {
        $('#errors').css('display', 'block');
        $('#alert').html('<strong>Error!</strong> ' + err);
    },
    hideError: function() {
        $('#errors').css('display', 'none');
    },
    isEmptyOrSpaces: function(str) {
        return str === null || str.match(/^ *$/) !== null;
    }
}

/* === String Extensions === */
String.prototype.endsWith = function (suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

String.prototype.charExists = function(index, value) {
    return index >= 0 && index < this.length && this.charAt(index) === value;
}

String.prototype.strip = function() {
    var tmp = document.createElement("div");
    tmp.innerHTML = this;
    return tmp.textContent || tmp.innerText || "";
}

/* === DataClient === */
function DataClient(apiKey, changeCallback, authCallback) {
    console.log('creating DataClient');
    this.client = new Dropbox.Client({key: apiKey});

    this.authCallback = authCallback;
    this.changeCallback = changeCallback;

    this.data = null;
    this.notepads = null;
    this.initialized = false;
    
    console.log('beginning authentication');
    this.authenticate(false);

    if (this.client.isAuthenticated()) {
        this.initialize();
    }
}

DataClient.prototype.authenticate = function(interactive) {
    var _this = this;
    var doInteractively = (arguments.length == 0) ? true : interactive;

    this.client.authenticate({interactive: doInteractively}, function(error) {
        console.log('auth: error = ' + error);
        _this.authCallback(error, _this.client.isAuthenticated());
    });
}

DataClient.prototype.initialize = function() {
    console.log('beginning initialization');
    
    if (!this.client.isAuthenticated()) {
        console.log('error: not authenticated');
        return;
    }

    var _this = this;
    var datastoreManager = this.client.getDatastoreManager();

    datastoreManager.openDefaultDatastore(function (error, datastore) {
        if (error) {
            util.showError('Unable to access data.');
        }

        _this.data = datastore;
        _this.notepads = _this.data.getTable('notepads');
        _this.initialized = true;
        _this.changeCallback(_this);
        _this.addChangedListener(_this.changeCallback);
    });
}

DataClient.prototype.addChangedListener = function(callback) {
    var _this = this;
    console.log('adding changed listener');

    this.data.recordsChanged.addListener(function() {
        callback(_this);
    });

    callback(this);
};

DataClient.prototype.getPad = function(key) {
    if (!this.initialized) {
        return '';
    }

    var results = this.notepads.query({padname: key});
    return (results.length > 0) ? results[0].get('data') : '';
};

DataClient.prototype.setPad = function(key, newData) {
    if (!this.initialized) {
        return '';
    }

    var results = this.notepads.query({padname: key});

    if (results.length > 0) {
        results[0].set('data', newData);
    } else {
        this.notepads.insert({
            padname: key,
            data: newData,
            exists: true,
            created: new Date()
        });
    }
};

DataClient.prototype.createPad = function(key) {
    if (util.isEmptyOrSpaces(key)) {
        return;
    }
    if (this.padExists(key)) {
        alert('notepad already exists');
    } else {
        this.setPad(key, '');
    }
};

DataClient.prototype.getPadNames = function () {
    if (!this.initialized) {
        return '';
    }

    var results = this.notepads.query({exists: true});
    return results.map(function (x) {
        return x.get('padname');
    });
};

DataClient.prototype.padExists = function(key) {
    if (!this.initialized) {
        return '';
    }

    var results = this.notepads.query({padname: key});
    return results.length > 0;
};

DataClient.prototype.deletePad = function(key) {
    if (!this.initialized) {
        return '';
    }

    var results = this.notepads.query({padname: key});

    if (results.length > 0) {
        results[0].deleteRecord();
    }
};

/* === Renderer === */
function Renderer() {
    this.writer = new stmd.HtmlRenderer();
    this.reader = new stmd.DocParser();
}

Renderer.prototype.renderMath = function(input) {
    return katex.renderToString(input.strip());
}

Renderer.prototype.renderCenteredMath = function(input) {
    return '<div class="text-center">' + katex.renderToString('\\displaystyle {' + input.strip() + '}') + '</div>';
}

Renderer.prototype.render = function(input) {
    console.log('rendering');

    input = util.removeTags(input);
    input = input.split('\\\$').join('\\\\\$');
    input = this.writer.renderBlock(this.reader.parse(input));

    index = -1;
    prevIndex = -1;
    normalMathMode = false;
    centeredMathMode = false;
    output = '';
    _this = this;

    function renderCases() {
        if (normalMathMode) { // starting in math mode
            output += _this.renderMath(segment);
            normalMathMode = false;
        } else if (centeredMathMode) { // starting in centered mode
            output += _this.renderCenteredMath(segment);
            centeredMathMode = false;
        } else { // starting in normal mode
            output += segment;
            if (centeredToken) {
                centeredMathMode = true;
            } else {
                normalMathMode = true;
            }
        }
    }

    while ((index = input.indexOf('$', index + 1)) !== -1) {
        centeredToken = false;

        // escaped
        if (input.charExists(index - 1, '\\')) {
            continue;
        }

        // double signs
        if (input.charExists(index + 1, '$')) {
            centeredToken = centeredMathMode || !input.charExists(index + 2, '$') || index + 1 === input.length - 1;
        }

        segment = input.slice(prevIndex + 1, index);
        renderCases();

        if (centeredToken) { index++; }
        prevIndex = index;
    }

    segment = input.slice(prevIndex + 1);
    renderCases();

    return output.split('\\$').join('$');
};

/* === Main Execution === */
var defaultNotepad = 'default';
var currentNotepad = defaultNotepad;
var lastSave = '';

$(document).ready(function () {
    var renderer = new Renderer();

    function renderAction() {
        try {
            util.hideError();

            var input = $('#tex').val();
            lastSave = input;

            client.setPad(currentNotepad, input);
            $('#output').html(renderer.render(input));
        } catch (err) {
            util.showError(err.message);
        }
    }

    function populateNotepad(client) {
        console.log('populating notepad');
        var names, incoming;

        // check if we're using the default notepad
        if (currentNotepad === defaultNotepad) {
            names = client.getPadNames();
            if (names.length > 0) {
                currentNotepad = names[0];
            } else {
                // there are no notepads; create the default one
                $.get('defaultFile.md', function (input) {
                    client.setPad(defaultNotepad, input);
                });
            }
        }

        $('#current-notepad').text(currentNotepad);
        incoming = client.getPad(currentNotepad);
        if (incoming !== $('#tex').val() && incoming != lastSave) {
            $('#tex').val(incoming);
            renderAction();
        }

        renderNotepadSelector(client);
    }

    function renderNotepadSelector(client) {
        var names = client.getPadNames();

        var list = names.map(function(x) {
            var name = util.removeTags(x);
            return '<li><a class="swap-notepad" href="#" data-dismiss="modal">' + name + '</a>'
                    + '<a class="remove-notepad" href="#" data-notepad="' + name + '"><i class="fa fa-times"></i></a></li>';
        }).join('');

        $('#notepad-selection').html('<ul>' + list + '</ul>');

        $('#notepad-selection li a.swap-notepad').click(function () {
            currentNotepad = $(this).text();
            populateNotepad(client);
            $('#notepadModal').modal('hide');
            return false;
        });

        $('#notepad-selection li a.remove-notepad').click(function () {
            name = $(this).data('notepad');
            var confirmation = confirm('Are you sure you want to delete notepad "' + name + '"?');

            if (confirmation) {
                if (name === currentNotepad) {
                    currentNotepad = defaultNotepad;
                }
                client.deletePad(name);
            }

            populateNotepad(client);
            return false;
        });
    }

    var client = new DataClient('7nj69doyzp49ge1', populateNotepad, function(error, isAuthenticated) {
        console.log('isAuthenticated = ' + isAuthenticated);

        if (error) {
            util.showError('Unable to authenticate.');
            $('#dropbox-button').addClass('disabled');
        } else if (isAuthenticated) {
            $('#dropbox').css('display', 'none');
            $('#app').css('display', 'block');
            $('#current-notepad').css('display', 'inline-block');
        }
    });

    $('#render').click(renderAction);
    $('#tex').bind('keydown', 'ctrl+return', renderAction);

    $('#dropbox-button').click(function () { 
        client.authenticate();
        client.initialize();
    });

    $('#notepad-creation').submit(function() {
        var key = $('#new-notepad-name').val();
        $('#new-notepad-name').val('');
        client.createPad(key)
        renderNotepadSelector(client);
        return false;
    });
});