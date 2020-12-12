'use strict';

var signal;
var timeout;
var buffer = [];
var newline = false;
var canUndo;

var invalid = false;

var myName;
var myChat = '';

var standardLayout = true;
var mainView = true;

var dotThreshold = 200;
var letterThreshold = 600;

const SPACE_CHAR = ' ';

const PORT = 3637;

var socket;

function keyDown(event) {
	if (event.code == 'Tab') {
		// disable tab entirely
		event.preventDefault();
	}
	if (event.repeat) {
		// none of the hotkeys work if you hold them down
		return;
	}

	let responseInput = document.getElementById('response-input');
	
	// space is the most important key, handle it first
	if (event.code == 'Space' && !event.shiftKey) {
		signalOn();
		responseInput.blur();
	} else {
		if (inProgress()) {
			// backspace is the only hotkey that works here
			if (event.code == 'Backspace') {
				cancel();
			}
		} else if (event.code == 'Tab') {
			changeView();
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
			switch (event.code) {		
				case 'Space': addSpace(); break;
				case 'Backspace': undo(); break;
				case 'Enter': endLine(); break;
				case 'KeyV': changeLayout(); break;
				case 'KeyI':
					responseInput.focus(); 
					responseInput.select(); 
					break;
				default: return;
			}
			event.preventDefault();
		}
	}
	clearFeedback();
	
	// TODO: fix this
	if (invalid) {
		clearTimeout(timeout);
		clearInvalid();
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
	let isDot = duration < dotThreshold;
	signal = 0;
	// console.log(duration);
	buffer.push(isDot ? '.': '-');
	displaySymbol(isDot);
	timeout = setTimeout(endSequence, letterThreshold);
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
	setActiveChat();
	updateChat(myName, myChat, newline);
	message = {chat: myChat};
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
		setActiveChat();
		updateChat(myName, myChat);
		send({chat: myChat});
		canUndo = false;
	}
}

function endLine() {
	if (!inProgress()) {
		myChat = '';
		setActiveChat();
		canUndo = false;
		newline = true;
	}
}

function inProgress() {
	return signal || buffer.length;
}

function clearInvalid() {
	setInvalid(false);
	clearSymbols();
}

// NETWORK FUNCTIONS

function connect() {
	if (socket) {
		socket.close(4002);
	}
	myName = new URLSearchParams(window.location.search).get('name') || localStorage.getItem('name');
	let url = `ws://${window.location.hostname || 'localhost'}:${PORT}/${myName}`;
	socket = new WebSocket(url);
	console.log(`connecting to ${url}`);
	socket.onmessage = function(event) {
		receive(JSON.parse(event.data));
		console.log(event.data);
	};
	socket.onclose = function(event) {
		console.log(`disconnected (${event.code}): ${event.reason || 'no reason'}`);
		setPrompt('\xa0');
		setLockText('Disconnected');
		setLocks(0);
		createCodebook([]);
		socket = null;
		setDisconnectMessage(`Disconnected! ${event.code}: ${event.reason || 'no reason given'}\nPlease refresh the page to try again.`);
	};
}

function send(data) {
	if (socket) {
		socket.send(JSON.stringify(data));
	} else {
		console.log(data);
		// TODO?
	}
}

function receive(data) {
	if (data.backlog) {
		for (let chat of data.backlog) {
			createChat(chat.name, chat.content);
		}
	}
	if (data.chat) {
		updateChat(data.chat.name, data.chat.content, data.chat.newline);
	}
	if (data.goal != undefined) {
		setLocks(data.goal);
	}
	if (data.codebook) {
		createCodebook(data.codebook);
	}
	if (data.prompt) {
		setPrompt(data.prompt);
	}
	if (data.feedback != undefined) {
		setFeedback(data.feedback ? 'Correct!' : 'Incorrect.');
	}
	if (data.myChat) {
		myChat = data.myChat;
		setActiveChat();
	}
	if (data.victory) {
		unlock(data.victory.url, data.victory.dialIn);
	}
}

function sumbitResponse(response) {
	send({response: response.trim().toLowerCase()});
}

// UI FUNCTIONS


function updateChat(name, content, newline) {
	let updater;
	if (newline) {
		updater = createChat(name);
	} else {
		updater = latestChat[name];
		if (!updater) {
			updater = createChat(name);
		}
	}
	updater.set(content);
}

function changeView() {
	mainView ^= true;
	display();
}

function changeLayout() {
	standardLayout ^= true;
	mainView = true;
	display();
}

function display() {
	if (standardLayout) {
		show('display', mainView);
		show('chat', mainView);
		show('morse', !mainView)
	} else {
		show('display', true);
		show('chat', true);
		show('morse', mainView);
	}
	// show('morse', standardLayout ^ mainView);
	show('codebook', !mainView);
}

function show(id, state) {
	document.getElementById(id).classList.toggle('hidden', !state);
}

function setActiveChat() {
	setNodeText('message', myChat);
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
	document.getElementById('chat').prepend(chatNode);
	
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

// function highlight(span) {
	// let input = document.getElementById('response-input');
	// input.value = span.innerText;
	// input.focus();
// }

function setPrompt(text) {
	setNodeText('prompt-text', text);
}

function clearFeedback() {
	setFeedback('\xa0'); // hack?
}

function setFeedback(text) {
	setNodeText('feedback-text', text);
}

function createCodebook(codebook) {
	document.getElementById('codebook-table').innerHTML = 
		codebook.map(entry => `<div><span>${entry[0]}:</span><span>${entry[1]}</span></div>`).join('')
}

var locks = 0;

function setLocks(count) {
	let bounded = Math.max(count, 0);
	let container = document.getElementById('lock-container');
	for (let i = 0; i < bounded - locks; i++) {
		container.append(LOCK.cloneNode(false));
	}
	for (let i = 0; i < locks - bounded; i++) {
		container.lastChild.remove();
	}
	locks = bounded;
}

function setLockText(text) {
	setNodeText('lock-text', text);
}

function setDisconnectMessage(text) {
	show('game', false);
	show('disconnect', true);
	setNodeText('disconnect', text);
}

function unlock(url, dialIn) {
	show('game', false);
	show('victory', true);
	document.getElementById('video-call').href = url;
	setNodeText('dial-in', dialIn);
	document.body.classList.add('victory-background');
}

function setNodeText(id, text) {
	document.getElementById(id).innerText = text;
}

window.onload = function() {
	connect();
};

function fastMode() {
	if (dotThreshold == 200) {
		dotThreshold = 100;
		letterThreshold = 300;
		console.log('fast mode enabled');
	} else {
		dotThreshold = 200;
		letterThreshold = 600;
		console.log('fast mode disabled');
	}
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
