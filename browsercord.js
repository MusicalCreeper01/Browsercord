const SENDRECV = 'sendrecv';
const RECVONLY = 'sendonly';

function concatSDP(...parts) {
    return parts.join('\n').trim() + '\n';
}

function transformCandidates(sdp, payloadType) {
    return sdp.replace('ICE/SDP', `RTP/SAVPF ${payloadType}`).trim();
}

let generateSDP;
if (0 == 1/*platform.name === 'Firefox'*/) {
    const DEFAULT_STREAM = [0, 'default', true];

    generateSDP = (type, payloadType, candidates, mode, streams, bitrate) => {
        candidates = transformCandidates(candidates, payloadType);

        streams = [DEFAULT_STREAM, ...streams];

        const bundles = streams.map((_, i) => `sdparta_${i}`).join(' ');

        const mlines = streams.map(([ssrc, cname, active], i) => {
            if (active) {
                return `${candidates}
a=${mode === SENDRECV && i === 0 ? 'sendrecv' : 'sendonly'}
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=mid:sdparta_${i}
b=AS:${bitrate}
a=msid:${cname}-${ssrc} ${cname}-${ssrc}
a=rtcp-mux
a=rtpmap:${payloadType} opus/48000/2
a=setup:actpass
a=ssrc:${ssrc} cname:${cname}-${ssrc}`;
            }
            else {
                return `m=audio 0 RTP/SAVPF ${payloadType}
c=IN IP4 0.0.0.0
a=inactive
a=rtpmap:${payloadType} NULL/0`;
            }
        });

        return concatSDP(
`v=0
o=mozilla...THIS_IS_SDPARTA 6054093392514871408 0 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE ${bundles}
a=msid-semantic:WMS *`,
...mlines
        );
    };
}
else {
    generateSDP = (type, payloadType, candidates, mode, streams, bitrate) => {
        let ssrcs = streams
        .filter(([ssrc, cname, active]) => active)
        .map(([ssrc, cname]) => {
            return `a=ssrc:${ssrc} cname:${cname}
a=ssrc:${ssrc} msid:${cname} ${cname}`;
        });
        return concatSDP(
`v=0
o=- 6054093392514871408 3 IN IP4 127.0.0.1
s=-
t=0 0
a=setup:${type === 'answer' ? 'passive' : 'actpass'}`,
transformCandidates(candidates, payloadType),
`a=rtcp-mux
a=mid:audio
b=AS:${bitrate}
a=${mode == SENDRECV ? 'sendrecv' : 'sendonly'}
a=rtpmap:${payloadType} opus/48000/2
a=fmtp:${payloadType} minptime=10; useinbandfec=1
a=maxptime:60`,
...ssrcs
        );
    };
}

SDP={
    getOpusPayloadType: function (sdp) {
        return sdp.match(/a=rtpmap:(\d+) opus/)[1];
    },
    createSessionDescription: function(type, payloadType, candidates, mode, streams, bitrate) {
        return new RTCSessionDescription({
            type: type,
            sdp: generateSDP(type, payloadType, candidates, mode, streams, (bitrate || 40000) / 1000)
        });
    },
    getSSRS: function(sdp){
        var ssrc = sdp.replace(/\r/g, '')
        .split('\n')
        .map(line => {
            if (!/^a=ssrc:/.test(line)) {
                return null;
            }
            return line;
        })
        .filter(line => line != null);
        var ssrcs = [];
        ssrc.forEach(function(ssr){
            if(ssr.split('cname:')[1] != undefined){
                ssrcs.push([
                    ssr.split(' ')[0].split(':')[1],
                    ssr.split('cname:')[1],
                    1
                ])
            }
        })
        return ssrcs;
    },
    filterTCPCandidates: function (sdp) {
        return sdp
        .replace(/\r/g, '')
        .split('\n')
        .map(line => {
            if (!/^a=candidate:/.test(line)) {
                return line;
            }

            let tokens = line.split(' ');
            tokens = tokens.slice(0, 2).concat([tokens[2].toUpperCase(), ...tokens.slice(3)]);

            if (tokens[2] === 'TCP') {
                return null;
            }

            return tokens.join(' ');
        })
        .filter(line => line != null)
        .join('\n');
    },
    getCandidates: function (sdp) {
        return sdp
        .replace(/\r/g, '')
        .split('\n')
        .map(line => {
            if (!/^a=candidate:/.test(line)) {
                return null;
            }
            return line;
        })
        .filter(line => line != null)
        .join('\n');
    }

}


var api_endpoint = 'https://discordapp.com/api/';

navigator.getUserMedia = navigator.getUserMedia ||
navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

function hasGetUserMedia() {
    return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
}

var discord = function (settings){
    var Discord = {};

    settings = settings || {};

    if(settings.token == undefined) {
        if(localStorage.getItem("discord_token") != null)
        settings.token = localStorage.getItem("discord_token");
    }

    var callbacks = {};

    Discord.on = function(event, callback){
        if(callbacks[event] == undefined)
        callbacks[event] = [];
        callbacks[event].push(callback);
    }

    function emit(event, data){
        if(callbacks[event] != undefined){
            callbacks[event].forEach(function(callback){
                if(data != undefined)
                callback(data);
                else
                callback();
            })
        }
    }
    Discord.emit = emit;

    // Discord.messages = {};

    var error = settings.error || function (err) {
        console.error('['+err.source+'] ' + err.msg)
        emit('error', err)
    }

    Discord.get = settings.get || function (url, headers, callback, errorCallback) {
        var xhr = new XMLHttpRequest();
        url = api_endpoint + url;
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4){
                var data = xhr.responseText;
                if(xhr.getResponseHeader("Content-type")!= undefined){
                    if(xhr.getResponseHeader("Content-type").indexOf('application/json') > -1){
                        data = JSON.parse(xhr.responseText);
                    }
                }
                if(xhr.status == 200) {
                    callback(data, xhr);
                } else {
                    if(errorCallback) {
                        errorCallback(data, xhr);
                    }
                }
            }
        }
        xhr.open("GET", url, true); // true for asynchronous
        if(headers) {
            for(var p in headers) {
                if(headers.hasOwnProperty(p)) {
                    xhr.setRequestHeader(p, headers[p]);
                }
            }
        }
        xhr.send();
    }

    Discord.post = settings.post || function (url, headers, data, callback, errorCallback) {
        var xhr = new XMLHttpRequest();
        url = api_endpoint + url;
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4){
                var data = xhr.responseText;
                if(xhr.getResponseHeader("Content-type").indexOf('application/json') > -1){
                    data = JSON.parse(xhr.responseText);
                }
                if(xhr.status == 200) {
                    callback(data, xhr);
                } else {
                    if(errorCallback) {
                        errorCallback(data, xhr);
                    }
                }
            }
        }
        xhr.open("POST", url, true); // true for asynchronous
        xhr.setRequestHeader('Content-type', 'application/json');
        if(headers) {
            for(var p in headers) {
                if(headers.hasOwnProperty(p)) {
                    xhr.setRequestHeader(p, headers[p]);
                }
            }
        }
        if(data) {
            reqData = JSON.stringify(data);
            xhr.send(reqData);
        } else {
            xhr.send();
        }
    }

    var getHeaders = function (){
        return {
            'Authorization': settings.token,
            //'User-Agent': settings.device != undefined ? settings.device+' (n/a, 1.0)' : 'Browsercord (n/a, 1.0)'
        }
    }
    Discord.callID = undefined;

    Discord.gateway = {
        get: function(callback) {
            if(localStorage.getItem('discord_gateway') == null){
                Discord.get('/gateway', getHeaders(), function(data, xhr){
                    localStorage.setItem('discord_gateway', data.url + "?v=5&encoding=json");
                    callback(data.url + "?v=5&encoding=json");
                }, function(data, xhr){
                    error({source: 'Fetching Gateway', msg: data})
                })
            }else {
                callback(localStorage.getItem('discord_gateway'));
            }
        },
        socket: undefined,
        heartbeat: 5000,
        last_sequence: 0,
        session_id : undefined,
        callbacks: {},
        next_callbacks: {},
        emit: function(event, data){
            if(this.callbacks[event] != undefined)
            this.callbacks[event].forEach(function(callback){
                callback(data);
            })
            if(this.next_callbacks[event] != undefined){
                this.next_callbacks[event].forEach(function(callback){
                    callback(data);
                })
                delete this.next_callbacks[event];
            }
        },
        on: function(event, callback){
            if(this.callbacks[event] == undefined)
            this.callbacks[event] = [];
            this.callbacks[event].push(callback);
        },
        off: function(callback) {
            this.callbacks.forEach(function(event){
                if(event.indexOf(callback) > -1)
                event.splice(event.indexOf(callback), 1);
            })
        },
        next: function (event, callback) {
            if(this.next_callbacks[event] == undefined)
            this.next_callbacks[event] = [];
            this.next_callbacks[event].push(callback);
        },
        gateway: undefined,
        calls: {},
        connect: function(url, callback){
            var p = this;
            this.gateway = url;
            this.socket = new WebSocket(url);
            this.socket.onopen = function(e){
                p.emit('open');
            };

            this.socket.onmessage = function(e) {
                data = e.data;
                if(typeof(e.data) == "string"){
                    data = JSON.parse(e.data);
                } else if (e.data instanceof Blob){
                    if(pako != undefined){
                        var reader = new FileReader();
                        reader.addEventListener("loadend", function() {
                            var inflated = pako.inflate(reader.result);
                            var data = JSON.parse(String.fromCharCode.apply(null, new Uint16Array(inflated)))

                            if(data.t == "READY") {
                                console.log("[Gateway] Ready!")
                                p.session_id = data.d.session_id;
                                if(this.reconnecting){
                                    this.reconnecting = false;
                                    p.emit('reconnected');
                                }else{
                                    p.emit('ready');
                                }
                                Discord.settings = data.d;
                                callback();
                            }
                            p.emit('message', data)
                        });
                        reader.readAsArrayBuffer(e.data);
                    }else{
                        console.log('Pako not found, Discord.settings is not avaliable because pako is needed to decode the opcode 2 binary packet that contains the settings.')

                        if(this.reconnecting){
                            this.reconnecting = false;
                            p.emit('reconnected');
                        }else{
                            p.emit('ready');
                        }
                    }
                    return;
                }
                if(data.op != undefined && data.op == 10){
                    p.heartbeat = data.d.heartbeat_interval;
                    setInterval(function(){
                        if(p.socket != undefined)
                        p.socket.send(JSON.stringify({op: 1, d: null}));
                    }, p.heartbeat);
                    console.log('[Gateway] Beating to ' + p.heartbeat)
                    //OP 2 identity packet
                    p.socket.send(JSON.stringify({
                        op: 2,
                        d: {
                            token: settings.token,
                            compress: true,
                            large_threshold: 100,
                            presence:{
                                status: "online",
                                since: 0,
                                afk: false,
                                game: null
                            },
                            properties: {
                                os: settings.os || "windows",
                                browser: settings.device || "browscord",
                                device: settings.device || "browscord",
                                referrer: "",
                                referring_domain: ""
                            }
                        }
                    }))

                }else if (data.op == 11){
                    console.log('[Gateway] Server is beating...');
                }
                if (data.op == 0) {
                    var event = data.t;
                    var d = data.d;
                    p.emit(event, d);
                    if(event == "MESSAGE_CREATE")
                    Discord.emit('message', d);
                    if(Discord.user != undefined){
                        if(event == "CALL_CREATE" && (Discord.callID != d.channel_id)){
                            /* Make a short delay before calling the event, for some reason if
                               the call is answered directly after the event is fired, it invalidates
                               the current socket session, disconnecting the voice client. */
                            setTimeout(()=>{
                                Discord.emit('call', d);
                            }, 1000)
                        }
                    } else {
                        // console.error('Discord.user is not set, call events will not be fired');
                    }
                    if(event == "PRESENCE_UPDATE")
                        Discord.emit('presence', d);
                    if(event == "MESSAGE_DELETE")
                        Discord.emit('delete', d);
                    if(event == "MESSAGE_UPDATE")
                        Discord.emit('edited', d);
                }
                if(data.s != undefined)
                last_sequence = data.s;
                if(data.op != undefined)
                p.emit('OP' + data.op, data)
                p.emit('message', data)
            };

            this.socket.onerror = function(e){
                console.error('[GATEWAY] Socket Error')
                console.error(e);
                if(p.socket.readyState  == p.socket.CLOSED)
                p.close(true);
                p.emit('socketError', e)
            }

            this.socket.onclose = function(e){
                console.error('[GATEWAY] Socket Closed! ' + e.reason);
                console.error(e);

                p.close(true);
                p.emit('socketClosedError', e)
            }
        },
        reconnecting: false,
        close: function(reconnect){
            this.socket.onclose = undefined;
            this.socket.onerror = undefined;
            this.socket.close();
            this.socket = undefined;

            this.session_id = undefined;

            if(reconnect){
                this.reconnecting = true;
                this.connect(this.gateway);
            }else {
                this.callbacks = {};
                this.next_callbacks = {};
                this.gateway = undefined;
            }

            this.emit('closed')
        },
        send: function(data){
            this.socket.send(JSON.stringify(data));
        }
    };

    Discord.voice = {
        socket: undefined,
        callbacks: {},
        next_callbacks: {},
        internal_callbacks: {},
        emit: function(event, data){
            if(this.callbacks[event] != undefined)
            this.callbacks[event].forEach(function(callback){
                callback(data);
            })
            if(this.internal_callbacks[event] != undefined)
            this.internal_callbacks[event].forEach(function(callback){
                callback(data);
            })
            if(this.next_callbacks[event] != undefined){
                this.next_callbacks[event].forEach(function(callback){
                    callback(data);
                })
                delete this.next_callbacks[event];
            }
        },
        on: function(event, callback){
            if(this.callbacks[event] == undefined)
            this.callbacks[event] = [];
            this.callbacks[event].push(callback);
        },
        internal: function(event, callback){
            if(this.internal_callbacks[event] == undefined)
            this.internal_callbacks[event] = [];
            this.internal_callbacks[event].push(callback);
        },
        off: function(callback) {
            this.callbacks.forEach(function(event){
                if(event.indexOf(callback) > -1)
                event.splice(event.indexOf(callback), 1);
            })
        },
        next: function (event, callback) {
            if(this.next_callbacks[event] == undefined)
            this.next_callbacks[event] = [];
            this.next_callbacks[event].push(callback);
        },
        rtc: undefined,
        payloadType: undefined,
        stream: undefined,
        remoteDesc: undefined,
        offer: undefined,
        audioElements: [],
        remoteStream: undefined,
        connect: function(state, serverdata){
            var p = this;

            p.socket.send(JSON.stringify({ // Step #2
                op: 0,
                d: {
                    "user_id": state.user_id,
                    "token": serverdata.token,
                    "session_id": state.session_id,
                    "server_id": state.guild_id || p.channel
                }
            }))

            p.next('OP2', function(ssrcpacket){ // Step #3
                console.log('[VOICE] UDP Connection Information: ')
                console.log(ssrcpacket)

                Discord.get('voice/ice', getHeaders(), function(iceservers){
                    console.log('[VOICE] ICE Servers')
                    console.log(iceservers)
                    var servers = iceservers.servers;

                    navigator.getUserMedia({
                        audio: true,
                        video: false
                    }, function(audiostream){
                        console.log('[VOICE] Got user\'s audio stream')

                        p.stream = audiostream;

                        console.log('[WebRTC] Connecting to ICE servers...')
                        p.rtc = new RTCPeerConnection({
                            iceServers: servers
                        },{
                            optional: [{
                                DtlsSrtpKeyAgreement: true
                            }]
                        });

                        p.rtc.onnegotiationneeded = function () {
                            console.log('[WebRTC] Negotiation Needed');
                            p.rtc.createOffer(function(offer){
                                p.offer = offer;
                                p.payloadType = SDP.getOpusPayloadType(offer.sdp);
                                console.log('[WebRTC] Created Offer');
                                p.rtc.setLocalDescription(offer).then(
                                    function() {
                                        console.log('[WebRTC] Local description set!');
                                        console.log(offer);
                                        p.offer = offer;
                                        console.log('[WebRTC] Negotiation Complete');
                                    },
                                    function(err){
                                        console.error('[WebRTC] Error settings local description');
                                        console.error(err);
                                    }
                                );
                            },
                            function(){
                                console.log('offer fail')
                            },{
                                mandatory: {
                                    OfferToReceiveAudio: true,
                                    OfferToReceiveVideo: false
                                },
                                optional: [
                                    {VoiceActivityDetection: true}
                                ]
                            }
                        );
                    };

                    p.iceGatheringTimeout = setTimeout(function() {
                        if (p.rtc.iceGatheringState !== 'complete') {
                            console.log('[WebRTC] ICE gathering never completed');
                            p.rtc.onicecandidate({candidate: null});
                        }
                    }, 5000)

                    var gotall = false;
                    p.rtc.onicecandidate = function(e) {
                        if(e.candidate == null && !gotall){
                            gotall = true;
                            clearTimeout(p.iceGatheringTimeout)
                            var t = SDP.filterTCPCandidates(p.rtc.localDescription.sdp);
                            p.emit('offer', t);

                            console.log('[WebRTC] Recived All ICE Candidates')
                            console.log(t)

                            console.log('[VOICE] Sending local Description via websocket..')

                            p.socket.send(JSON.stringify({
                                op: 1,
                                d: {
                                    protocol: "webrtc",
                                    data: t//p.offer
                                }
                            }))

                            p.next('OP4', function(remoteresp){
                                console.log(remoteresp)
                                console.log('[WebRTC] Recived Remote Description!')
                                console.log(remoteresp.d.sdp)
                                p.payloadtype = SDP.getOpusPayloadType(p.rtc.localDescription.sdp);
                                console.log('[WebRTC] Creating remote description...')

                                var sdp = SDP.createSessionDescription('answer', p.payloadtype, remoteresp.d.sdp, 'sendrecv', [], 64000);
                                console.log(sdp)
                                console.log('[WebRTC] Created remote description!')

                                p.rtc.setRemoteDescription(sdp, () => {
                                    console.log('[WebRTC] Remote Description Set!')

                                    p.speaking(true)
                                    // p.emit('ready');
                                }, err => {
                                    console.error('[WebRTC] Error Setting Remote Description!');
                                    console.error(err);
                                })
                            })

                        } else {
                        }
                    };
                    p.rtc.onsignalingstatechange = function(e){
                        console.log('[WebRTC] onsignalingstatechange => ' + p.rtc.signalingState)
                        if (p.rtc.signalingState === "have-remote-offer") {
                            p.rtc.createAnswer(answer => {
                                console.error('[WebRTC] Created answer, applying..')

                                p.rtc.setLocalDescription(offer).then(
                                    function() {
                                        console.log('[WebRTC] Local description set!');
                                        console.log(offer);
                                        p.offer = offer;

                                    },
                                    function(err){
                                        console.error('[WebRTC] Error settings local description');
                                        console.error(err);
                                    }
                                );

                            }, err => {
                                console.error('[WebRTC] Error creating answer')
                                console.error(err);
                            })
                        }
                    }

                    p.rtc.onaddstream = function(e){
                        console.log('[WebRTC] Recived Remote stream!');

                        var ao = document.createElement("audio");
                        ao.setAttribute('id', 'discord-audio-output');
                        ao.setAttribute('autoplay', '')
                        document.body.appendChild(ao);

                        p.remoteStream = window.remoteStream = ao.srcObject = e.stream;


                        p.audioElements.push(ao);
                    };
                    p.rtc.oniceconnectionstatechange = function(e){
                        let connectionState = p.rtc.iceConnectionState;
                        console.log('[WebRTC] iceConnectionState => ' + connectionState);
                        if(connectionState == 'completed'){

                            if(p.reconnecting){
                                p.emit('reconnected')
                                p.reconnecting = false;
                            }else{
                                p.emit('ready');
                            }
                        } else if (connectionState == 'disconnected') {
                            p.emit('disconnected');
                            p.close(true);
                        }
                    }

                    p.rtc.addStream(p.stream);

                }, function(){
                    console.error('[VOICE] Failed to get user audio stream!')
                });
            })

        })
    },
    heartbeatID: undefined,
    guild: undefined,
    channel: undefined,
    join: function (guild, channel, callback) {
        if(!hasGetUserMedia()){
            console.error('getUserMedia is not supported by your browser! As such, the browser cannot send your voice to the other clients')
        }

        var p = this;

        //Discord.get('channels/' + channel, getHeaders(), function(data, xhr){
        //    Discord.get('guilds/' + guild, getHeaders(), function(data, xhr){

        p.guild = guild;
        p.channel = channel;

        console.log('[VOICE] Joining voice...');

        var state = undefined;

        Discord.gateway.next('VOICE_STATE_UPDATE', function(data){
            console.log('voice state packet')

            state = data;
        })

        Discord.gateway.next('VOICE_SERVER_UPDATE', function(serverdata){
            if(state == undefined)
            return console.error("server update was called before state update, strange?");
            console.log('[VOICE] Server Information: ' + JSON.stringify(serverdata))
            console.log('[VOICE] Server: ' + serverdata.endpoint);

            p.socket = new WebSocket('wss://'+serverdata.endpoint.split(':')[0]);

            p.socket.onerror = function(e){
                console.error('[VOICE] Socket Error')
                console.error(e);
                p.emit('socketError', e)
            }

            p.socket.onclose = function(e){
                console.error('[VOICE] Socket Closed! ' + e.reason);
                console.error(e);
                p.close(true);
                p.emit('socketClosedError', e)
            }

            p.socket.onmessage = function(e) {
                data = e.data;
                if(typeof(e.data) == "string")
                data = JSON.parse(e.data);

                if(data.op != undefined)
                p.emit('OP' + data.op, data)
                p.emit('message', data)
            };

            p.internal('message', function(data){
                if (data.op == 11){
                    console.log('[VOICE] Server is beating...');
                }
            })

            p.socket.onopen = function(e){
                p.emit('open');

                p.next('OP2', function(data){ // Step #1
                    console.log('[VOICE] Beating to ' + data.d.heartbeat_interval)
                    p.heartbeat = data.d.heartbeat_interval;
                    heartbeatID = setInterval(function(){
                        if(p.socket != undefined)
                        p.socket.send(JSON.stringify({op: 3, d: new Date().getTime()}));
                    }, p.heartbeat);

                })

                p.connect(state, serverdata);
            };

        })

        if(p.guild == null){
            Discord.gateway.send({
                "op": 13,
                "d": {
                    "channel_id": p.channel
                }
            })
        }

        Discord.gateway.send({
            "op": 4,
            "d": {
                "guild_id": guild,
                "channel_id": channel,
                "self_mute": settings.mute || false,
                "self_deaf": settings.deaf || false
            }
        })
        //}, function(err, xhr){
        //    callback({code: 2, msg: 'invalid-channel'})
        //})
        //}, function(err, xhr){
        //    callback({code: 1, msg: 'invalid-guild'})
        //})

    },
    call: function (userid, callback) {
        var q = this;
        //CALL_USER
        // this.join(,callback)
        Discord.get('users/@me/channels', getHeaders(), function(data, xhr){
            for(var i = 0; i < data.length; ++i) {
                if(data[i].recipient.id == userid){
                    console.log(q);
                    Discord.callID = data[i].id;
                    q.join(null, data[i].id, callback);
                    break;
                }
            }
            Discord.post('users/@me/channels', getHeaders(), {
                "recipient_id": userid
            }, function(channel, xhr){
                Discord.callID = channel.id;
                q.join(null, channel.id, callback);
            }, (data, xhr) => {
                if(callback != undefined)
                callback()
                error({source: 'users/@me/channels', msg: data});
            })
        }, (data, xhr) => {
            if(callback != undefined)
            callback()
            error({source: 'users/@me/channels', msg: data});
        })
    },
    reconnecting: false,
    close: function (keepcallbacks) {
        console.log('[VOICE] Call to close..')

        Discord.gateway.send({
            "op": 4,
            "d": {
                "guild_id": null,
                "channel_id": null,
                "self_mute": false,
                "self_deaf": false
            }
        })

        var p = this;
        if(p.heartbeatID != undefined)
        clearInterval(p.heartbeatID);
        if(p.iceGatheringTimeout != undefined)
        clearTimeout(p.iceGatheringTimeout)

        Discord.callID = undefined;

        if(p.rtc != undefined){
            p.rtc.oniceconnectionstatechange = undefined;
            p.rtc.onaddstream = undefined;
            p.rtc.onsignalingstatechange = undefined;
            p.rtc.onicecandidate = undefined;
            p.rtc.close();
        }
        if(p.socket != undefined){
            p.socket.onclose = undefined;
            p.socket.close();
        }

        p.rtc = undefined;
        p.socket = undefined;

        p.next_callbacks = {};
        p.internal_callbacks = {};

        p.audioElements.forEach(function(el){
            el.parentNode.removeChild(el);
        })
        p.audioElements = [];

        if(keepcallbacks && settings.reconnect) {
            console.log('[VOICE] Unexpected close, reconnecting...')
            p.reconnecting = true;
            p.emit('reconnecting');
            p.join(p.guild, p.channel)
        }else if (keepcallbacks != undefined && keepcallbacks == false) {
            p.callbacks = {};
        }else{
            console.log('[VOICE] Cleaning up...')
            p.channel = undefined;
            p.guild = undefined;

            p.emit('closed');
            //p.callbacks = {};
            console.log('[VOICE] Closed!')
        }
    },
    isSpeaking: false,
    speaking: function(speak){
        if(this.socket != undefined){
            this.isSpeaking = speak;
            this.socket.send(JSON.stringify({
                op:5,
                d: {
                    delay: 0,
                    speaking: speak
                }
            }))

            this.emit('speaking', !speak);
        }
    },
    deafened: false,
    muted: false,
    mute: function(mute){
        var p = this;

        if(Discord.gateway.socket != undefined){
            p.muted = mute;
            Discord.gateway.send({
                "op": 4,
                "d": {
                    "guild_id": p.guild,
                    "channel_id": p.channel,
                    "self_mute": p.muted,
                    "self_deaf": p.deafened
                }
            })
            p.speaking(!p.muted)
        }
    },
    deaf: function(deaf){
        var p = this;

        if(p.audioElements.length  > 0){
            p.deafened = deaf;

            if(Discord.gateway.socket != undefined){
                Discord.gateway.send({
                    "op": 4,
                    "d": {
                        "guild_id": p.guild,
                        "channel_id": p.channel,
                        "self_mute": p.muted,
                        "self_deaf": p.deafened
                    }
                })
            }

            p.audioElements.forEach(function(el){
                el.muted = deaf;
            });
        }
    }

}

function extendUser(user){
    user.mention = '<@' + user.id + '>';

    return user;
}

Discord.checkToken = function(token, callback){
    token = token || settings.token;

    Discord.get('users/@me', getHeaders(), function(data, xhr){
        callback(true);
    }, function(data, xhr){
        if(xhr.status == 401 || xhr.status == 402)
        callback(false);
        else
        error({source: 'Token Check', msg: data})
    })
}

Discord.requiresMFA = function(email, password, callback){
    Discord.post(api_endpoint + 'auth/login', false, {
        "email": email,
        "password": password
    }, function(logindata){
        callback(logindata.mfa);
    }, function(data, xhr){
        error({source: 'MFA Check', msg: data})
    })
}

var init = function(){
    Discord.gateway.get(function(gateway){
        console.log("got gateway url: " + gateway);
        Discord.gateway.connect(gateway, function(){
            console.log('connected to gateway!');
            Discord.getUser((err, user) => {
                Discord.user = user;
                emit('ready')
            })
        });
    })
}

Discord.getUser = function(callback){
    if(callback == undefined)
    return;
    Discord.get('users/@me', getHeaders(), function(data, xhr){
        var user = extendUser(data);
        user.avatar = "https://cdn.discordapp.com/avatars/" + user.id + "/" + user.avatar + ".png";

        Discord.get('users/@me/relationships', getHeaders(), function(data, xhr){
            user.friends = data;

            Discord.get('users/@me/guilds', getHeaders(), function(data, xhr){
                user.guilds = data;

                Discord.get('users/@me/channels', getHeaders(), function(data, xhr){
                    user.DMs = data;

                    Discord.get('users/@me/connections', getHeaders(), function(data, xhr){
                        user.connections = data;

                        callback(null, user)
                    }, data => {
                        callback(data, undefined)
                        error({source: 'users/@me/connections', msg: data});
                    })

                }, data => {
                    callback(data, undefined)
                    error({source: 'users/@me/channels', msg: data});
                })

            }, data => {
                callback(data, undefined)
                error({source: 'users/@me/guilds', msg: data});
            })
        }, data => {
            callback(data, undefined)
            error({source: 'users/@me/relationships', msg: data});
        })
    }, data => {
        callback(data, undefined)
        error({source: 'users/@me/relationships', msg: data});
    })
}

Discord.getGuilds = Discord.getServers = function(callback){
    if(callback == undefined)
    return;
    Discord.get('users/@me/guilds', getHeaders(), function(data, xhr){
        callback(null, data);

    }, data => {
        callback(data, undefined)
        error({source: 'users/@me/guilds', msg: data});
    })
}


if(settings.token == undefined|| settings.reauth || localStorage.getItem("discord_email") != settings.email){
    if(settings.email == undefined && settings.password == undefined)
    return error({source: 'Login', msg: 'if token is not specified email and password must be (an optionally mfa with an mfa code)'});

    Discord.post('auth/login', false, {
        "email": settings.email,
        "password": settings.password
    }, function(logindata){
        if(!logindata.mfa){
            Discord.token = logindata.token;
            if(settings.save || true)
            localStorage.setItem("discord_token", logindata.token);
            emit('logged_in', logindata.token);
            init();
        }else{
            if(settings.mfa == undefined)
            return error({source: 'MFA', msg: 'mfa is enabled for this account, but mfa code ({mfa:"00 000"}) isn\'t specified!'});

            Discord.post('auth/mfa/totp', false, {
                "code": settings.mfa,
                "ticket": logindata.ticket
            }, function(mfadata){
                Discord.token = mfadata.token;
                if(settings.save || true)
                localStorage.setItem("discord_token", mfadata.token);
                localStorage.setItem("discord_email", settings.email);
                emit('loggedIn', mfadata.token);
                init();
            }, function(mfaerr){
                emit('mfaError', mfaerr);
                return error({source: 'MFA', msg: mfaerr});
            })
        }
    }, function(loginerr){
        return error({source: 'MFA', msg: loginerr});
    })

}else{
    Discord.checkToken(settings.token, function(valid){
        if(!valid) {
            emit('tokenInvalid', mfadata.token);
        } else {
            emit('loggedIn', settings.token);
            init();
        }
    })
}

return Discord;
}
