'use strict';

var signal;
var timeout;
var buffer = [];
var newline = false;
var canUndo;

var invalid = false;

var myName;
var activeChat = '';

var standardLayout = true;
var mainView = true;

var dotThreshold = 200;
var letterThreshold = 600;

// consider changing this to interpunct
const SPACE_CHAR = ' ';

const PORT = 3637;

var socket;

function keyDown(event) {
	if (event.code == 'Tab' || event.code == 'Backspace') {
		// disable these entirely
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
	activeChat += letter;
	showActiveChat();
	updateChat(myName, activeChat, newline);
	let message = {chat: activeChat};
	if (newline) {
		message.newline = true;
		newline = false;
	}
	send(message);
}

function addSpace() {
	if (activeChat.length && activeChat[activeChat.length - 1] != SPACE_CHAR) {
		addLetter(SPACE_CHAR);
	}
}

function undo() {
	if (canUndo && activeChat.length) {
		activeChat = activeChat.slice(0, -1);
		showActiveChat();
		updateChat(myName, activeChat);
		send({chat: activeChat});
		canUndo = false;
	}
}

function endLine() {
	if (!inProgress()) {
		activeChat = '';
		showActiveChat();
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
	let url = `ws://${window.location.hostname || 'localhost'}:${PORT}/${myName}`;
	socket = new WebSocket(url);
	console.log(`connecting to ${url}`);
	socket.onmessage = function(event) {
		receive(JSON.parse(event.data));
		console.log(event.data);
	};
	socket.onclose = function(event) {
		console.log(`disconnected (${event.code}): ${event.reason || 'no reason'}`);
		showPrompt('\xa0');
		showLockText('Disconnected');
		showLocks(0);
		createCodebook([]);
		socket = null;
		showDisconnectMessage(`Disconnected! ${event.code}: ${event.reason || 'no reason given'}\nPlease refresh the page to try again.`);
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
		showLocks(data.goal);
	}
	if (data.codebook) {
		createCodebook(data.codebook);
	}
	if (data.prompt) {
		showPrompt(data.prompt);
		if (data.feedback == undefined) {
			// TODO: this means your contact disconnected
		}
	}
	if (data.feedback != undefined) {
		showFeedback(data.feedback ? 'Correct!' : 'Incorrect.');
	}
	if (data.activeChat) {
		activeChat = data.activeChat;
		showActiveChat();
	}
	if (data.victory) {
		showVictory(data.victory.url, data.victory.dialIn);
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
	updater(content);
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

function showActiveChat() {
	setNodeText('message', activeChat);
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
	
	let updater = function(content) {
		chatText = content;
		chatTextNode.innerText = content;
	};
	latestChat[name] = updater;
	return updater;
}

function showPrompt(text) {
	setNodeText('prompt-text', text);
	setNodeText('prompt-text-help', '(' + text + ')');
}

function clearFeedback() {
	showFeedback('\xa0'); // hack?
}

function showFeedback(text) {
	setNodeText('feedback-text', text);
}

function createCodebook(codebook) {
	document.getElementById('codebook-table').innerHTML = 
		codebook.map(entry => `<div><span>${entry[0]}:</span><span>${entry[1]}</span></div>`).join('')
}

var locks = 0;

function showLocks(count) {
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

function showLockText(text) {
	setNodeText('lock-text', text);
}

function showDisconnectMessage(text) {
	show('game', false);
	show('disconnect', true);
	setNodeText('disconnect', text);
}

function showVictory(url, dialIn) {
	show('game', false);
	show('victory', true);
	document.getElementById('video-call').href = url;
	setNodeText('dial-in', dialIn);
	document.body.classList.add('victory-background');
}

function setNodeText(id, text) {
	document.getElementById(id).innerText = text;
}

function closeHelp() {
	show('help', false);
}

window.onload = function() {
	myName = new URLSearchParams(window.location.search).get('name') || localStorage.getItem('name');
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
