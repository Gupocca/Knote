var writer = new stmd.HtmlRenderer();
var reader = new stmd.DocParser();
var defaultNotepad = 'default';
var currentNotepad = defaultNotepad;

// sanitization
var tagBody = '(?:[^"\'>]|"[^"]*"|\'[^\']*\')*';
var tagOrComment = new RegExp('<(?:!--(?:(?:-*[^->])*--+|-?)|script\\b'+tagBody+'>[\\s\\S]*?</script\\s*|style\\b'+tagBody +'>[\\s\\S]*?</style\\s*|/?[a-z]'+tagBody+')>','gi');
function removeTags(html) {
	var oldHtml;
	do {
		oldHtml = html;
		html = html.replace(tagOrComment, '');
	} while (html !== oldHtml);
	return html.replace(/</g, '&lt;');
}

// bulk of the code
$(document).ready(function() {

	var populateNotepad = function() { 
		// check if we're using the default notepad
		if (currentNotepad == defaultNotepad) {
			var names = getNotepadNames();
			if (names.length > 0) {
				currentNotepad = names[0];
			}
			else {
				// there are no notepads; create the default one
				$.get("defaultFile.md", function(input) {
					setData(defaultNotepad, input);
				});
			}
		}

		$('#current-notepad').text(currentNotepad);

		var incoming = getData(currentNotepad);
		if (incoming != $('#tex').val()) {
			$('#tex').val(getData(currentNotepad));
			renderTex();
		}

		renderNotepadSelection();
	}

	var renderNotepadSelection = function() {
		var names = getNotepadNames();
		var output = '<ul>';

		for (var i = 0; i < names.length; i++) {
			var name = removeTags(names[i]);
			output += '<li><a class="swap-notepad" href="#" data-dismiss="modal">'+name+'</a>'
					+ '<a class="remove-notepad" href="#" data-notepad="'+name+'"><i class="fa fa-times"></i></a></li>';
		}
		output += '</ul>';
		$('#notepad-selection').html(output);

		$('#notepad-selection li a.swap-notepad').click(function () {
			currentNotepad = $(this).text();
			populateNotepad();
			$('#notepadModal').modal('hide');
			return false;
		});

		$('#notepad-selection li a.remove-notepad').click(function () {
			var name = $(this).data('notepad');
			var confirmation = confirm('Are you sure you want to delete notepad "'+name+'"?');

			if (confirmation) {
				if (name == currentNotepad) {
					currentNotepad = defaultNotepad;
				}
				deleteNotepad(name);
			}

			populateNotepad();
			return false;
		});
	}

	function isEmptyOrSpaces(str){
		return str === null || str.match(/^ *$/) !== null;
	}

	var createNewNotepad = function() {
		var name = $('#new-notepad-name').val();
		$('#new-notepad-name').val('');

		if (isEmptyOrSpaces(name)) {
			return;
		}

		if (isExistingNotepad(name)) {
			alert("notepad already exists");
		}
		else {
			setData(name,'');
			renderNotepadSelection();
		}	
	}

	$('#notepad-creation').submit(function () {
		createNewNotepad();
		return false;
	});

	var showError = function(err) {
		$('#errors').css('display', 'block');
		$('#alert').html("<strong>Error!</strong> " + err);
	}

	var hideError = function() {
		$('#errors').css('display', 'none');
	}

	var client = new Dropbox.Client({key: "7nj69doyzp49ge1"});
	var allData = null;

	client.authenticate({interactive: false}, function (error) {
		if (error) {
			showError("Unable to authenticate.")
			$('#dropbox-button').addClass('disabled');
		}
	});

	var checkAuth = function() {
		if (client.isAuthenticated()) {
			$('#dropbox').css('display','none');
			$('#app').css('display','block');
			$('#current-notepad').css('display','inline-block');
		}
	};

	checkAuth();

	$('#dropbox-button').click(function() {
		client.authenticate({}, function (error) {
			if (error) {
				showError("Unable to authenticate.")
				$('#dropbox-button').addClass('disabled');
			}
			checkAuth();
		});
	});

	var openDataChannels = function() {
		console.log("Channels");
		var datastoreManager = client.getDatastoreManager();
		datastoreManager.openDefaultDatastore(function (error, datastore) {
			if (error) {
				showError("Unable to access data.");
			}
			
			allData = datastore;

			datastore.recordsChanged.addListener(function (event) {
				populateNotepad();
			});

			populateNotepad();
		});
	}

	openDataChannels();

	var setData = function(key, newData) {
		if (allData === null) {
			return;
		}

		var notepadTable = allData.getTable('notepads');
		var results = notepadTable.query({padname: key});

		if (results.length > 0) {
			var notepad = results[0];
			notepad.set('data', newData);
		}
		else {
			var newNotepad = notepadTable.insert({
				padname: key,
				data: newData,
				exists: true,
				created: new Date()
			});
		}
	}

	var getData = function(key) {
		if (allData === null) {
			return '';
		}

		var notepadTable = allData.getTable('notepads');
		var results = notepadTable.query({padname: key});

		if (results.length > 0) {
			return results[0].get('data');
		}
		return '';
	}

	var deleteNotepad = function(key) {
		if (allData === null) {
			return;
		}

		var notepadTable = allData.getTable('notepads');
		var results = notepadTable.query({padname: key});

		if (results.length > 0) {
			results[0].deleteRecord();
		}
	}

	var deleteAllNotepads = function(key) {
		var names = getNotepadNames();
		for (var i = 0; i < names.length; i++)
		{
			deleteNotepad(names[i]);
		}
	}

	var isExistingNotepad = function(key) {
		if (allData === null) {
			return false;
		}

		var notepadTable = allData.getTable('notepads');
		var results = notepadTable.query({padname: key});
		return results.length > 0;
	}

	var getNotepadNames = function() {
		if (allData === null) {
			return '';
		}

		var notepadTable = allData.getTable('notepads');
		var results = notepadTable.query({exists: true});

		if (results.length > 0) {
			var names = new Array();

			for (var i = 0; i < results.length; i++)
			{
				names[i] = results[i].get('padname');
			}

			return names;
		}
		else {
			return '';
		}
	}

	// utility function
	function strip(html)
	{
		var tmp = document.createElement("div");
		tmp.innerHTML = html;
		return tmp.textContent || tmp.innerText || "";
	}

	String.prototype.endsWith = function(suffix) {
	    return this.indexOf(suffix, this.length - suffix.length) !== -1;
	};

	var renderMath = function(data) {
		return katex.renderToString(strip(data));
	}

	var renderCenteredMath = function(data) {
		return '<div class="text-center">' + katex.renderToString(strip(data)) + '</div>';
	}

	var charExists = function(str, index, value) {
		return index >= 0 && index < str.length && str.charAt(index) == value;
	};

	function replaceAll(string, find, replace) {
		return string.replace(new RegExp(escapeRegExp(find), 'g'), replace);
	}

	var renderTex = function() {
		hideError();

		var math = document.getElementById("output");
		var input = $('#tex').val();

		setData(currentNotepad, input);
		input = input.split('\\\$').join('\\\\\$')	
		input = writer.renderBlock(reader.parse(input));

		var index = -1;
		var prevIndex = -1;
		var normalMathMode = false;
		var centeredMathMode = false;
		var output = '';

		try {
			while ((index = input.indexOf('$', index+1)) != -1) {
				/* ESCAPES */
				if (charExists(input, index-1, '\\')) {
					continue;
				}

				/* DOUBLE SIGNS */
				var centeredToken = false;
				if (charExists(input, index+1, '$')) {
					centeredToken = centeredMathMode || !charExists(input, index+2, '$') || index+1 == input.length-1;
				}

				var segment = input.slice(prevIndex + 1, index);

				/* CASES */
				if (normalMathMode) { // starting in math mode
					output += renderMath(segment);
					normalMathMode = false;
				}
				else if (centeredMathMode) { // starting in centered mode
					output += renderCenteredMath(segment);
					centeredMathMode = false;
				}
				else { // starting in normal mode
					output += segment;
					if (centeredToken) { centeredMathMode = true; }
					else { normalMathMode = true; }
				}

				if (centeredToken) { index++; }
				prevIndex = index;
			}

			var segment = input.slice(prevIndex + 1);
			if (normalMathMode) { output += renderMath(segment); }
			else if (centeredMathMode) { output += renderCenteredMath(segment); }
			else { output += segment; }

			$('#output').html(output.split('\\$').join('$'));
		}
		catch (err) {
			showError(err.message);
		}
	}
	
	// autofocus
	$('#tex').focus();

	// create bindings for rendering
	$('#render').click(renderTex);
	$('#tex').bind('keydown', 'ctrl+return', renderTex);
});