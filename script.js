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

const PORT = 3637;

var socket;

function connect(name) {
	socket = new WebSocket(`ws://${window.location.hostname}:${PORT}/${name}`);
	socket.onmessage = function(event) {
		console.log(name + ': ' + event.data);
	};
	socket.onclose = function(event) {
		console.log(name + ' is disconnected: ' + event.reason);
		socket = null;
	};
}

function keyDown(event) {
	if (!event.repeat) {
		if (event.code == 'Space' && !event.shiftKey) {
			signalOn();
		} else if (inProgress()) {
			if (event.code == 'Backspace') {
				cancel();
			}
		} else {
			switch (event.code) {
				case 'Space': addSpace(); break;
				case 'Backspace': deleteLast(); break;
				case 'Enter': endLine(); break;
				default: return;
			}
		}
		event.preventDefault();
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
	let isDot = duration < DOT_THRESHOLD;
	signal = 0;
	// console.log(duration);
	buffer.push(isDot ? '.': '-');
	displaySymbol(isDot);
	timeout = setTimeout(endSequence, CODE_THRESHOLD);
	lightOn(false);
}

function endSequence() {
	let letter = MORSE[buffer.join('')];
	buffer.length = 0;
	if (letter) {
		addLetter(letter);
		clearSymbols();
	} else {
		setInvalid(true);
		timeout = setTimeout(clearInvalid, 1000);
		canDelete = false;
	}
}

function addLetter(letter) {
	canDelete = true;
	message.push(letter);
	display();
	send(letter);
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
		addLetter(SPACE_CHAR);
	}
}

function deleteLast() {
	if (canDelete && message.length) {
		message.pop();
		display();
		canDelete = false;
		send('delete');
	}
}

function endLine() {
	if (!inProgress()) {
		display();
		message.length = 0;
		canDelete = false;
		send('newline');
	}
}

function inProgress() {
	return signal || buffer.length;
}

function send(code) {
	if (socket) {
		socket.send(code);
	}
}

function clearInvalid() {
	setInvalid(false);
	clearSymbols();
}

// UI FUNCTIONS

function display() {
	document.getElementById('message').innerText = message.join('');
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
