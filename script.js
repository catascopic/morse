'use strict';

var signal;
var timeout;
var buffer = [];
var invalid = false;
var canDelete;

var message = [];

const DOT_THRESHOLD = 200;
const CODE_THRESHOLD = 600;

const SPACE_CHAR = ' ';

function keyDown(event) {
	if (!event.repeat) {
		if (event.code == 'Space' && !event.shiftKey) {
			signalOn()
		} else if (inProgress()) {
			if (event.code == 'Backspace') {
				cancel();
			}
		} else {
			switch (event.code) {
				case 'Space': addSpace(); break;
				case 'Backspace': deleteLast(); break;
				case 'Enter': endLine(); break;
				default:
			}
		}
		if (invalid) {
			clearTimeout(timeout);
			clearInvalid();
		}
	}
}

function keyUp(event) {
	if (event.code == 'Space' && signal) {
		signalOff();
	}
}

function signalOn() {
	signal = Date.now();
	clearTimeout(timeout);
	lightOn(true);
}

function signalOff() {
	let duration = Date.now() - signal;
	console.log(duration);
	let isDot = duration < DOT_THRESHOLD;
	signal = 0;
	buffer.push(isDot ? '.': '-');
	displaySymbol(isDot);
	timeout = setTimeout(endCode, CODE_THRESHOLD);
	lightOn(false);
}

function endCode() {
	let code = MORSE[buffer.join('')];
	buffer.length = 0;
	if (code) {
		send(code);
		clearSymbols();
	} else {
		lightOn(false);
		setInvalid(true);
		timeout = setTimeout(clearInvalid, 1000);
		canDelete = false;
	}
}

function send(code) {
	canDelete = true;
	message.push(code);
	display();
}

function cancel() {
	signal = 0;
	buffer.length = 0;
	canDelete = false;
	clearTimeout(timeout);
	lightOn(false);
	clearSymbols();
}

function addSpace() {
	if (message.length && message[message.length - 1] != SPACE_CHAR) {
		send(SPACE_CHAR);
	}
}

function deleteLast() {
	if (canDelete && message.length) {
		message.pop();
		display();
		canDelete = false;
	}
}

function endLine() {
	if (!inProgress()) {
		canDelete = false;
		message.length = 0;
		display();
	}
}

function inProgress() {
	return signal || buffer.length;
}

function display() {
	document.getElementById('message').innerText = message.join('');
}

function clearInvalid() {
	setInvalid(false);
	clearSymbols();
}

function lightOn(state) {
	document.getElementById('icon').classList.toggle('on', state);
}

function setInvalid(state) {
	invalid = state;
	document.getElementById('symbols').classList.toggle('invalid', state);
}

const DOT = new Image();
const DASH = new Image();
DOT.src = 'dot.svg';
DASH.src = 'dash.svg';

function displaySymbol(isDot) {
	document.getElementById('symbols').appendChild((isDot ? DOT : DASH).cloneNode(false));
}

function clearSymbols() {
	let symbols = document.getElementById('symbols');
	while (symbols.firstChild) {
		symbols.lastChild.remove();
	}
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
	"-----": "0",
	
	".-.-.-": ".",
	"--..--": ",",
	"..--..": "?",
	".----.": "'",
	"-.-.--": "!",
	"-..-." : "(",
	"-..-.-": ")",
	".-..." : "&",
	"---...": ":",
	"-.-.-.": ";",
	".-.-." : "+",
	"-....-": "-",
	"..--.-": "_",
	".-..-.": "\"",
	"...-..-": "$",
	".--.-.": "@",
	"-..-." : "/"
};
