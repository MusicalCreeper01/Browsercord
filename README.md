# Browsercord

Browsercord is a complete fully-featured Discord library for the browser. It also features voice support, which doesn't exist in other browser libraries. 

# A Note about voice

The official documented apis for using voice with Discord use UDP packet streams to send the voice information. 

JavaScript can't communicate with UDP streams for security reasons, so normally you couldn't use voice with native JavaScript in the browser.

However once I found that out that I wondered how the Discord web client used voice. After doing a bunch of poking around I figured out that Discord has undocumented WebRTC STUN and TURN servers that they user for the web client.

After that I proceeded to learn how to use WebRTC and figured out how to connect to the servers and stream data.

Now since the RTC servers are undocumented they may change at any time without warning and break the voice part of the library. Be warned.





