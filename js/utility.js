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
    }
}
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
    });
}

DataClient.prototype.addChangedListener = function(callback) {
    var _this = this;

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

DataClient.prototype.setPad = function() {
    
};

DataClient.prototype.getPadNames = function () {
    var results, names;
    if (!this.initialized) {
        return '';
    }

    results = this.notepads.query({exists: true});
    names = results.map(function (x) {
        return x.get('padname');
    });
    
    return names;
};

DataClient.prototype.padExists = function() {
    
};

DataClient.prototype.deletePad = function() {

};

var defaultNotepad = 'default';
var currentNotepad = defaultNotepad;

$(document).ready(function () {
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
        if (incoming !== $('#tex').val()) {
            $('#tex').val(client.getPad(currentNotepad));
            // renderTex();
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
                deleteNotepad(name);
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

    $('#dropbox-button').click(function () { 
        client.authenticate();
        client.initialize();
        client.addChangedListener(populateNotepad);
    });
});