# Browsercord

Browsercord is a complete fully-featured Discord library for the browser. It also features voice support, which doesn't exist in other browser libraries. 

# A Note about voice

The official documented apis for using voice with Discord use UDP packet streams to send the voice information. 

JavaScript can't communicate with UDP streams for security reasons, so normally you couldn't use voice with native JavaScript in the browser.

However once I found that out that I wondered how the Discord web client used voice. After doing a bunch of poking around I figured out that Discord has undocumented WebRTC STUN and TURN servers that they user for the web client.

After that I proceeded to learn how to use WebRTC and figured out how to connect to the servers and stream data.

Now since the RTC servers are undocumented they may change at any time without warning and break the voice part of the library. Be warned.

# Installation

Simply download the browsercord.js file and include it in your page, it's that simple! 
Note that at the moment there isn't a minified version of the file, I'll get around to that later on. You can minify it yourself, but be aware that the SDP object at the top of the file MUST have it's strucute preserved or it will cause issues with generating the remote description.

Although not required, I would also recommend using adapter.js (https://github.com/webrtc/adapter) to ensure that Browsercord works with browsers that add prefixs to some of the WebRTC functions.

Another library that Browsercord optionally depends on is Pako (https://github.com/nodeca/pako), when the library connects to the Discord gateway a zgiped json object (Opcode 2) is sent that includes things like user settings (which is accessable with `#.settings`) which you can't retrive any other way. If pako is not included the library can't decompress that object, so it will simply be droppped. 

One other library you may want to use in your implimentation is Hark (https://github.com/otalk/hark). You can funnel the browser audio stream into it, and set the threshold to detect when the user is speaking, and call `#.voice.speaking(isSpeaking)` to set the speaking indicator on the reciving clients. (note that `#.voice.speaking(false)` mutes your audio to other clients as well).

Example use of hark: 
```JavaScript
var d = discord(options);

d.voice.on('ready', function(){ // voice has connected to the channel and is transmitting
	console.log('VOICE READY')

	/* Example use of HARK to set if the user is speaking
	   or not, by adjusting the threshold it can also be
	   used as noise cancelation.

	 |---------------------------------|
	 | 0 ------------------------ -100 |
	 | Loudest Sounds    |    No Sound |
	 |---------------------------------|

	 If #voice.speaking() is not set, discord clients will
	 always show the user as speaking. If you are inputting
	 an audio stream (such as music) into the voice channel,
	 you will probably want it to always be 'true'. */
	 
  	var options = {
		threshold: -70
  	};
  	var speechEvents = hark(d.voice.stream, options);

  	speechEvents.on('speaking', function() {
		try { //if the voice server is connecting it can throw errors and stop the events from firing
			if(!d.voice.muted)
				d.voice.speaking(true);
		} catch(e) {}
	});

 	speechEvents.on('stopped_speaking', function() {
		try {
			if(!d.voice.muted)
				d.voice.speaking(false);
		} catch(e) {}
	});
})
```
