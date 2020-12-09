'use strict';

var signal;
var timeout;
var buffer = [];
var newline = false;
var canUndo;

var invalid = false;

var myName = 'PLU';
var myChat = '';

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
		clearFeedback();
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
				case 'Enter': endLine(); break;
				case 'KeyI': responseInput.focus(); break;
				case 'KeyM': setTab(activeTab == 'main' ? 'chart' : 'main'); break;
				default: return;
			}
			event.preventDefault();
		}
	}
	clearFeedback();
	if (invalid) {
		clearTimeout(timeout);
		clearInvalid();
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
	myChat += letter;
	display();
	updateChat(myName, myChat, newline);
	message = {message: myChat};
	if (newline) {
		message.newline = true;
		newline = false;
	}
	send(message);
}

function addSpace() {
	if (myChat.length && myChat[myChat.length - 1] != SPACE_CHAR) {
		addLetter(SPACE_CHAR);
	}
}

function undo() {
	if (canUndo && myChat.length) {
		myChat = myChat.slice(0, -1);
		display();
		updateChat(myName, myChat);
		send({message: myChat});
		canUndo = false;
	}
}

function endLine() {
	if (!inProgress() && myChat.length >= 5) {
		myChat = '';
		display();
		canUndo = false;
		newline = true;
	}
}

function inProgress() {
	return signal || buffer.length;
}

function send(data) {
	if (socket) {
		socket.send(JSON.stringify(data));
	} else {
		console.log(data);
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
			createChat(entry.name, entry.content);
		}
	}
	if (data.message) {
		updateChat(data.name, data.message, data.newline);
	}
	if (data.goal) {
		setLocks(data.goal);
	}
	if (data.prompt) {
		setPrompt(data.prompt);
	}
	if (data.feedback) {
		setFeedback(data.feedback);
	}
}

function updateChat(name, content, newline) {
	let updater = latestChat[name];
	if (newline || !updater) {
		updater = createChat(name);
	}
	updater.set(content);
}

// GAME FUNCTIONS

function sumbitResponse(response) {
	send({response: response.trim().toLowerCase()});
}

// UI FUNCTIONS


function setTab(tabName) {
	document.getElementById(activeTab).classList.add('hidden');	
	document.getElementById(tabName).classList.remove('hidden');
	activeTab = tabName;
}

function display() {
	document.getElementById('message').innerText = myChat;
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
const LOCK = new Image();
DOT.src = 'dot.svg';
DASH.src = 'dash.svg';
LOCK.src = 'lock.svg';

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
	chatNode.classList.toggle('my-chat', name == myName);
	
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
		},
		set: function(content) {
			chatText = content;
			chatTextNode.innerText = content;
			// innerHTML = content.split(' ').map(w => 
			// `<span class="word" onclick="highlight(this)">${w}</span>`).join(' ');
		}
	};
	latestChat[name] = updater;
	return updater;
}

function highlight(span) {
	let input = document.getElementById('response-input');
	input.value = span.innerText;
	input.focus();
}

function setPrompt(prompt) {
	document.getElementById('prompt-text').innerText = prompt;
}

function clearFeedback() {
	document.getElementById('feedback-text').innerText = '\xa0'; // hack?
}

function setFeedback(feedback) {
	document.getElementById('feedback-text').innerText = feedback;
}

function createCodebook(codebook) {
	document.getElementById('codebook-table').innerHTML = 
		codebook.map(entry => `<div><span>${entry[0]}:</span><span>${entry[1]}</span></div>`).join('')
}

var locks = 0;

function setLocks(amount) {
	let container = document.getElementById('lock-container');
	for (let i = 0; i < amount - locks; i++) {
		container.append(LOCK.cloneNode(false));
	}
	for (let i = 0; i < locks - amount; i++) {
		container.lastChild.remove();
	}
	locks = amount;
}

window.onload = function() {
	setLocks(32);
	createCodebook([["abroad","diverse"],["academic","describe"],["actual","grand"],["advance","refer"],["audience","regulate"],["business","reach"],["charge","annual"],["charity","visible"],["complete","relate"],["crowd","store"],["elect","whether"],["employ","dream"],["field","except"],["garlic","organize"],["impression","employment"],["increased","title"],["instead","shoulder"],["matter","little"],["mother","consume"],["nowhere","revolution"],["painful","amount"],["politics","completely"],["population","distribute"],["porch","difficulty"],["previous","crash"],["service","consist"],["shine","normally"],["square","realize"],["standard","closely"],["tobacco","sound"],["understand","general"],["waste","fighter"]]);
}

const MORSE = {
	".-"  : "A", "-...": "B", "-.-.": "C", "-.." : "D",
	"."   : "E", "..-.": "F", "--." : "G", "....": "H",
	".."  : "I", ".---": "J", "-.-" : "K", ".-..": "L",
	"--"  : "M", "-."  : "N", "---" : "O", ".--.": "P",
	"--.-": "Q", ".-." : "R", "..." : "S", "-"   : "T",
	"..-" : "U", "...-": "V", ".--" : "W", "-..-": "X",
	"-.--": "Y", "--..": "Z",

	".----": "1", "..---": "2", "...--": "3", "....-": "4",
	".....": "5", "-....": "6", "--...": "7", "---..": "8",
	"----.": "9", "-----": "0",
	
	".-.-.-": ".", "--..--": ",", "..--..": "?", ".----.": "'",
	"-.-.--": "!", "-..-." : "(", "-..-.-": ")", ".-..." : "&",
	"---...": ":", "-.-.-.": ";", ".-.-." : "+", "-....-": "-",
	"..--.-": "_", ".-..-.": '"', ".--.-.": "@", "...-..-": "$",
	"-..-." : "/"
};
