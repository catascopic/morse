'use strict';

var signal;
var timeout;
var buffer = [];
var invalid = false;
var canUndo;

var myName = 'PLU';
var message = '';

var activeTab = 'main';

const DOT_THRESHOLD = 200;
const CODE_THRESHOLD = 600;

const SPACE_CHAR = ' ';

const PORT = 3637;

var socket;

function connect(name) {
	socket = new WebSocket(`ws://${window.location.hostname}:${PORT}/${name}`);
	socket.onmessage = function(event) {
		receive(JSON.parse(event.data));
		console.log(name + ': ' + event.data);
	};
	socket.onclose = function(event) {
		console.log(name + ' is disconnected: ' + event.reason);
		socket = null;
	};
}

function keyDown(event) {
	if (event.repeat) {
		return;
	}

	let responseInput = document.getElementById('response-input');
	// space is always the morse key
	if (event.code == 'Space' && !event.shiftKey) {
		signalOn();
		responseInput.blur();
	} else if (document.activeElement == responseInput) {
		switch (event.code) {
			case 'Enter': 
				sumbitResponse(responseInput.value);
				responseInput.value = '';
			// fallthrough
			case 'Escape': responseInput.blur(); break;
			default:
		}
	} else {
		if (inProgress()) {
			if (event.code == 'Backspace') {
				cancel();
			}
		} else {
			switch (event.code) {				
				case 'Space': addSpace(); break;
				case 'Backspace': undo(); break;
				case 'Enter': newline(); break;
				case 'KeyI': responseInput.focus(); break;
				case 'KeyM': setTab(activeTab == 'main' ? 'chart' : 'main'); break;
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
	} else {
		switch (event.code) {
			// case 'KeyM': setTab('main'); break;
			default:
		}
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
		canUndo = false;
	}
}

function cancel() {
	signal = 0;
	buffer.length = 0;
	canUndo = false;
	clearTimeout(timeout);
	lightOn(false);
	clearSymbols();
}

function addLetter(letter) {
	canUndo = true;
	message += letter;
	display();
	send({signal: letter});
	// latestChat[myName].push(letter);
}

function addSpace() {
	if (message.length && message[message.length - 1] != SPACE_CHAR) {
		addLetter(SPACE_CHAR);
	}
}

// TODO: apply undo only when sending a letter?
function undo() {
	if (canUndo && message.length) {
		message = message.slice(0, -1);
		display();
		canUndo = false;
		send({'detete':true});
	}
}

// TODO: apply newline only when sending a letter?
function newline() {
	if (!inProgress() && message.length) {
		message = '';
		display();
		canUndo = false;
		send({newline: true});
	}
}

function inProgress() {
	return signal || buffer.length;
}

function send(data) {
	if (socket) {
		socket.send(JSON.stringify(data));
	} else {
		// TODO?
	}
}

function clearInvalid() {
	setInvalid(false);
	clearSymbols();
}

function receive(data) {
	if (data.backlog) {
		for (let entry of backlog) {
			createChat(entry.name, entry.text);
		}
	} else {
		let updater = latestChat[data.name];
		if (data.newline || !updater) {
			updater = createChat(data.name);
		}
		if (data.undo) {
			updater.pop();
		} else {
			updater.push(data.signal);
		}
	}
}

// GAME FUNCTIONS

function sumbitResponse(response) {
	send({response: response});
}

// UI FUNCTIONS


function setTab(tabName) {
	document.getElementById(activeTab).classList.add('hidden');	
	document.getElementById(tabName).classList.remove('hidden');
	activeTab = tabName;
}

function display() {
	document.getElementById('message').innerText = message;
}

function lightOn(state) {
	document.getElementById('icon').classList.toggle('on', state);
}

// TODO: red doesn't look good anymore

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

var latestChat = {};

function createChat(name, text='') {
	let chatText = text;
	let chatNode = document.createElement('div');
	chatNode.classList.add('chat');
	let chatNameNode = document.createElement('div');
	chatNameNode.classList.add('chat-name');
	chatNameNode.innerText = name;
	let chatTextNode = document.createElement('div');
	chatTextNode.classList.add('chat-message');
	chatTextNode.innerText = chatText;
	chatNode.append(chatNameNode, chatTextNode);
	document.getElementById('chats').prepend(chatNode);
	
	let updater = {
		push: function(letter) {
			chatText += letter;
			chatTextNode.innerText = chatText;
		},
		pop: function() {
			chatText = chatText.slice(0, -1);
			chatTextNode.innerText = chatText;
		}
	};
	latestChat[name] = updater;
	return updater;
}

function createCodebook(codebook) {
	document.getElementById('codebook-table').innerHTML = 
		codebook.map(entry => `<div><span>${entry[0]}:</span><span>${entry[1]}</span></div>`).join('')
}

window.onload = function() {
	createCodebook([["access","secure"],["adapt","whole"],["again","comment"],["artist","relevant"],["brother","repeatedly"],["creation","freedom"],["current","heart"],["defendant","desperate"],["distinct","structure"],["drawing","think"],["garden","shelf"],["importance","counter"],["infection","useful"],["instrument","traffic"],["interested","major"],["journal","slide"],["largely","appearance"],["manage","protein"],["national","disease"],["party","liberal"],["piece","prime"],["plate","summer"],["pollution","skill"],["portrait","economist"],["purchase","block"],["regional","energy"],["rifle","journalist"],["thick","because"],["thousand","incredible"],["weather","founder"],["while","taxpayer"],["yours","actually"]]);
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
