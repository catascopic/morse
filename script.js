'use strict';

var signal;
var timeout;
var buffer = [];

const DOT_THRESHOLD = 200;
const CODE_THRESHOLD = 600;

function on(event) {
	if (event.code == 'Space' && !event.repeat) {
		signal = Date.now();
		window.clearTimeout(timeout);
		lightOn(true);
	}
}

function off(event) {
	if (event.code == 'Space') {
		let duration = Date.now() - signal;
		let isDot = duration < DOT_THRESHOLD
		buffer.push(isDot ? '.': '-');
		displaySymbol(isDot);
		timeout = window.setTimeout(endCode, CODE_THRESHOLD);
		lightOn(false);
	}
}

function endCode() {
	let code = MORSE[buffer.join('')];
	document.getElementById('text').innerText += code || '?';
	// postData('http://catascopic.com', code);
	clearSymbols();
	buffer.length = 0;
}

function lightOn(state) {
	document.getElementById('icon').classList.toggle('on', state);
}

function displaySymbol(isDot) {
	let img = document.createElement('img');
	img.src = (isDot ? 'dot': 'dash') + '.svg';
	document.getElementById('symbols').appendChild(img);
}

function clearSymbols() {
	let symbols = document.getElementById('symbols');
	while (symbols.firstChild) {
		symbols.lastChild.remove();
	}
}

async function postData(url, data) {
	let response = await fetch(url, {
		method: 'POST',
		cache: 'no-cache',
		headers: { 
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(data)
	});
	return response.json();
}

const MORSE = {
	".-"  : "A",
	"-...": "B",
	"-.-.": "C",
	"-.." : "D",
	"."   : "E",
	"..-.": "F",
	"--." : "G",
	"....": "H",
	".."  : "I",
	".---": "J",
	"-.-" : "K",
	".-..": "L",
	"--"  : "M",
	"-."  : "N",
	"---" : "O",
	".--.": "P",
	"--.-": "Q",
	".-." : "R",
	"..." : "S",
	"-"   : "T",
	"..-" : "U",
	"...-": "V",
	".--" : "W",
	"-..-": "X",
	"-.--": "Y",
	"--..": "Z",
	
	".----": "1",
	"..---": "2",
	"...--": "3",
	"....-": "4",
	".....": "5",
	"-....": "6",
	"--...": "7",
	"---..": "8",
	"----.": "9",
	"-----": "0"
};
