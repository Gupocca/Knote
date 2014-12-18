$(document).ready(function() {  
	$('#render').click(function() {
		$('#output').html(render);
	});
	
	var renderMath = function(data) {
		return '<strong>'+data+'</strong>';
	}

	var renderCenteredMath = function(data) {
		return '<em>'+data+'</em>';
	}

	var charExists = function(str, index, value) {
		return index >= 0 && index < str.length && str.charAt(index) == value;
	};

	var render = function() {
		var input = $('#input').val();
		
		var index = -1;
		var prevIndex = -1;

		var normalMathMode = false;
		var centeredMathMode = false;

		var output = '';

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

		return output;
	};
});