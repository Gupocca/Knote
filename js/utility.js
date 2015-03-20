function showError(err) {
    $('#errors').css('display', 'block');
    $('#alert').html('<strong>Error!</strong> ' + err);
}

function DataClient(apiKey, authCallback) {
    console.log('creating DataClient');
    this.client = new Dropbox.Client({key: apiKey});
    console.log(this.client);
    this.authCallback = authCallback;

    this.data = null;
    this.notepads = null;
    this.initialized = false;
    
    console.log('beginning authentication');
    this.authenticate(false);
}

DataClient.prototype.authenticate = function(interactive) {
    var client = this.client;
    var callback = this.authCallback;
    var doInteractively = (arguments.length == 0) ? true : interactive;

    this.client.authenticate({interactive: doInteractively}, function(error) {
        console.log('auth: error = ' + error);
        callback(error, client.isAuthenticated());
    });
}

DataClient.prototype.initialize = function() {
    console.log('beginning initialization');
    
    if (!this.client.isAuthenticated()) {
        console.log('error: not authenticated');
        return;
    }

    var datastoreManager = this.client.getDatastoreManager();
    datastoreManager.openDefaultDatastore(function (error, datastore) {
        if (error) {
            showError('Unable to access data.');
        }

        this.data = datastore;
        this.notepads = this.data.getTable('notepads');
        this.initialized = true;
    });
    
    console.log('initialized = ' + this.initialized);
}

DataClient.prototype.addChangedListener = function(callback) {
    this.data.recordsChanged.addListener(callback);
    callback();
};

DataClient.prototype.getPad = function() {
    
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
        x.get('padname');
    })
    
    return names;
};

DataClient.prototype.padExists = function() {
    
};

DataClient.prototype.deletePad = function() {

};

var client = new DataClient('7nj69doyzp49ge1', function(error, isAuthenticated) {
    console.log('isAuthenticated = ' + isAuthenticated);

    if (error) {
        showError('Unable to authenticate.');
        $('#dropbox-button').addClass('disabled');
    } else if (isAuthenticated) {
        $('#dropbox').css('display', 'none');
        $('#app').css('display', 'block');
        $('#current-notepad').css('display', 'inline-block');
    }
});