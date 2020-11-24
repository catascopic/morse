'use strict';

var signal;
var timeout;
var buffer = [];

const DOT_THRESHOLD = 200;
const CODE_THRESHOLD = 600;

function on(event) {
	if (event.code == 'Space' && !event.repeat) {
		lightOn(true);
		signal = Date.now();
		window.clearTimeout(timeout);
	}
}

function off(event) {
	if (event.code == 'Space') {
		lightOn(false);
		let duration = Date.now() - signal;
		buffer.push(duration < DOT_THRESHOLD ? '.': '-');
		document.getElementById('buffer').innerText = buffer.join('');
		timeout = window.setTimeout(endCode, CODE_THRESHOLD);
	}
}

function lightOn(state) {
	document.getElementById('icon').classList.toggle('on', state);
}

function endCode() {
	let code = MORSE[buffer.join('')];
	document.getElementById('text').innerText += code || '?';
	// postData('http://catascopic.com', code);
	document.getElementById('buffer').innerText = '';
	buffer.length = 0;
}

async function postData(url, data) {
	let response = await fetch(url, {
		method: 'POST', // *GET, POST, PUT, DELETE, etc.
		mode: 'cors', // no-cors, *cors, same-origin
		cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
		credentials: 'same-origin', // include, *same-origin, omit
		headers: {
			'Content-Type': 'application/json' // 'Content-Type': 'application/x-www-form-urlencoded',
		},
		redirect: 'follow', // manual, *follow, error
		referrerPolicy: 'no-referrer',
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
