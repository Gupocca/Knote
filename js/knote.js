
var writer = new stmd.HtmlRenderer();
var reader = new stmd.DocParser();
var currentNotepad = '1234';

$(document).ready(function() {

	var populateNotepad = function() { 
		var incoming = getData(currentNotepad);
		if (incoming != $('#tex').val()) {
			$('#tex').val(getData(currentNotepad));
			renderTex();
		}

		renderNotebookSelection();
	}

	var renderNotebookSelection = function() {
		var names = getNotepadNames();
		var output = '<ul>';

		for (var i = 0; i < names.length; i++) {
			output += '<li>'+names[i]+'</li>';
		}
		output += '</ul>';
		$('#notepad-selection').html(output);

		$('#notepad-selection li').click(function () {
			currentNotepad = $(this).text();
			populateNotepad();
		});
	}

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
		else {
			return '';
		}
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

	// set up an "on render" function
	var renderTex = function() {
		hideError();

		var math = document.getElementById("output");
		var input = $('#tex').val();

		setData(currentNotepad, input);
		input = writer.renderBlock(reader.parse(input)).split('$');

		var output = "";
		var isMath = false;
		var isCentered = false;

		try {
			for (var piece in input) {
				if (input[piece] == "") {
					// double dollar signs escape to make math centered
					isMath = !isMath;
					isCentered = !isCentered;
				}

				if (isMath) {
					var rendered = katex.renderToString(strip(input[piece]));

					if (isCentered) {
						output += '<div class="text-center">' + rendered + '</div>';
					} else {
						output += rendered;
					}

					isCentered = false;
				} else {
					output += input[piece];
				}

				isMath = !isMath;
			}

			$('#output').html(output);
		} catch (err) {
			showError(err.message);
		}
	};

	// autofocus
	$('#tex').focus();

	// create bindings for rendering
	$('#render').click(renderTex);
	$('#tex').bind('keydown', 'ctrl+return', renderTex);
});