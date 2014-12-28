var writer = new stmd.HtmlRenderer();
var reader = new stmd.DocParser();
var defaultNotepad = 'default';
var currentNotepad = defaultNotepad;

var tagBody, tagOrComment, removeTags;

// bulk of the code
$(document).ready(function () {
	'use strict';
	var client, allData, getNotepadNames, populateNotepad, renderNotepadSelection, isEmptyOrSpaces, createNewNotepad, checkAuth, showError, hideError, openDataChannels, setData, getData, deleteNotepad, isExistingNotepad, strip, renderMath, renderCenteredMath, charExists, renderTex;

	client = new Dropbox.Client({key: "7nj69doyzp49ge1"});
	allData = null;

	getNotepadNames = function () {
		var i, names, results, notepadTable;
		if (allData === null) {
			return '';
		}

		notepadTable = allData.getTable('notepads');
		results = notepadTable.query({exists: true});

		if (results.length > 0) {
			names = [];

			for (i = 0; i < results.length; i++) {
				names[i] = results[i].get('padname');
			}

			return names;
		}
	};

	populateNotepad = function () {
		var names, incoming;

		// check if we're using the default notepad
		if (currentNotepad === defaultNotepad) {
			names = getNotepadNames();
			if (names.length > 0) {
				currentNotepad = names[0];
			} else {
				// there are no notepads; create the default one
				$.get('defaultFile.md', function (input) {
					setData(defaultNotepad, input);
				});
			}
		}

		$('#current-notepad').text(currentNotepad);

		incoming = getData(currentNotepad);
		if (incoming !== $('#tex').val()) {
			$('#tex').val(getData(currentNotepad));
			renderTex();
		}

		renderNotepadSelection();
	};

	renderNotepadSelection = function () {
		var names = getNotepadNames(), output = '<ul>', name, i;

		for (i = 0; i < names.length; i++) {
			name = removeTags(names[i]);
			output += '<li><a class="swap-notepad" href="#" data-dismiss="modal">' + name + '</a>'
					+ '<a class="remove-notepad" href="#" data-notepad="' + name + '"><i class="fa fa-times"></i></a></li>';
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
			name = $(this).data('notepad');
			var confirmation = confirm('Are you sure you want to delete notepad "' + name + '"?');

			if (confirmation) {
				if (name === currentNotepad) {
					currentNotepad = defaultNotepad;
				}
				deleteNotepad(name);
			}

			populateNotepad();
			return false;
		});
	};

	isEmptyOrSpaces = function (str) {
		return str === null || str.match(/^ *$/) !== null;
	};

	createNewNotepad = function () {
		var name = $('#new-notepad-name').val();
		$('#new-notepad-name').val('');

		if (isEmptyOrSpaces(name)) {
			return;
		}

		if (isExistingNotepad(name)) {
			alert("notepad already exists");
		} else {
			setData(name, '');
			renderNotepadSelection();
		}
	};

	$('#notepad-creation').submit(function () {
		createNewNotepad();
		return false;
	});

	showError = function (err) {
		$('#errors').css('display', 'block');
		$('#alert').html("<strong>Error!</strong> " + err);
	};

	hideError = function () {
		$('#errors').css('display', 'none');
	};

	client.authenticate({interactive: false}, function (error) {
		if (error) {
			showError("Unable to authenticate.");
			$('#dropbox-button').addClass('disabled');
		}
	});

	checkAuth = function () {
		if (client.isAuthenticated()) {
			$('#dropbox').css('display', 'none');
			$('#app').css('display', 'block');
			$('#current-notepad').css('display', 'inline-block');
		}
	};

	$('#dropbox-button').click(function () {
		client.authenticate({}, function (error) {
			if (error) {
				showError('Unable to authenticate.');
				$('#dropbox-button').addClass('disabled');
			}
			checkAuth();
		});
	});

	openDataChannels = function () {
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
	};

	setData = function (key, newData) {
		var notepadTable, results, notepad;

		if (allData === null) {
			return;
		}

		notepadTable = allData.getTable('notepads');
		results = notepadTable.query({padname: key});

		if (results.length > 0) {
			notepad = results[0];
			notepad.set('data', newData);
		} else {
			notepadTable.insert({
				padname: key,
				data: newData,
				exists: true,
				created: new Date()
			});
		}
	};

	getData = function (key) {
		var notepadTable, results;

		if (allData === null) {
			return '';
		}

		notepadTable = allData.getTable('notepads');
		results = notepadTable.query({padname: key});

		if (results.length > 0) {
			return results[0].get('data');
		}
		return '';
	};

	deleteNotepad = function (key) {
		var notepadTable, results;

		if (allData === null) {
			return;
		}

		notepadTable = allData.getTable('notepads');
		results = notepadTable.query({padname: key});

		if (results.length > 0) {
			results[0].deleteRecord();
		}
	};

	// var deleteAllNotepads = function (key) {
	//     var i, names = getNotepadNames();
	//     for (i = 0; i < names.length; i++) {
	//         deleteNotepad(names[i]);
	//     }
	// };

	isExistingNotepad = function (key) {
		var notepadTable, results;

		if (allData === null) {
			return false;
		}

		notepadTable = allData.getTable('notepads');
		results = notepadTable.query({padname: key});
		return results.length > 0;
	};

	// utility function
	strip = function (html) {
		var tmp = document.createElement("div");
		tmp.innerHTML = html;
		return tmp.textContent || tmp.innerText || "";
	};

	String.prototype.endsWith = function (suffix) {
		return this.indexOf(suffix, this.length - suffix.length) !== -1;
	};

	renderMath = function (data) {
		return katex.renderToString(strip(data));
	};

	renderCenteredMath = function (data) {
		return '<div class="text-center">' + katex.renderToString('\\displaystyle {' + strip(data) + '}') + '</div>';
	};

	charExists = function (str, index, value) {
		return index >= 0 && index < str.length && str.charAt(index) === value;
	};

	renderTex = function () {
		var input, index, prevIndex, normalMathMode, centeredMathMode, output, centeredToken, segment;
		hideError();

		input = $('#tex').val();

		setData(currentNotepad, input);
		input = input.split('\\\$').join('\\\\\$');
		input = writer.renderBlock(reader.parse(input));

		index = -1;
		prevIndex = -1;
		normalMathMode = false;
		centeredMathMode = false;
		output = '';

		try {
			while ((index = input.indexOf('$', index + 1)) !== -1) {
				/* ESCAPES */
				if (charExists(input, index - 1, '\\')) {
					continue;
				}

				/* DOUBLE SIGNS */
				centeredToken = false;
				if (charExists(input, index + 1, '$')) {
					centeredToken = centeredMathMode || !charExists(input, index + 2, '$') || index + 1 === input.length - 1;
				}

				segment = input.slice(prevIndex + 1, index);

				/* CASES */
				if (normalMathMode) { // starting in math mode
					output += renderMath(segment);
					normalMathMode = false;
				} else if (centeredMathMode) { // starting in centered mode
					output += renderCenteredMath(segment);
					centeredMathMode = false;
				} else { // starting in normal mode
					output += segment;
					if (centeredToken) {
						centeredMathMode = true;
					} else {
						normalMathMode = true;
					}
				}

				if (centeredToken) { index++; }
				prevIndex = index;
			}

			segment = input.slice(prevIndex + 1);

			if (normalMathMode) {
				output += renderMath(segment);
			} else if (centeredMathMode) {
				output += renderCenteredMath(segment);
			} else {
				output += segment;
			}

			$('#output').html(output.split('\\$').join('$'));
		} catch (err) {
			showError(err.message);
		}
	};

	checkAuth();
	openDataChannels();

	// autofocus
	$('#tex').focus();

	// create bindings for rendering
	$('#render').click(renderTex);
	$('#tex').bind('keydown', 'ctrl+return', renderTex);
});

// sanitization
tagBody = '(?:[^"\'>]|"[^"]*"|\'[^\']*\')*';
tagOrComment = new RegExp('<(?:!--(?:(?:-*[^->])*--+|-?)|script\\b' + tagBody + '>[\\s\\S]*?</script\\s*|style\\b' + tagBody  + '>[\\s\\S]*?</style\\s*|/?[a-z]' + tagBody + ')>', 'gi');

removeTags = function (html) {
	'use strict';
	var oldHtml;
	do {
		oldHtml = html;
		html = html.replace(tagOrComment, '');
	} while (html !== oldHtml);
	return html.replace(/</g, '&lt;');
};