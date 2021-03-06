/*
 * Copyright (c) 2008-2016, Massachusetts Institute of Technology (MIT)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
define(["ext", "jquery", "atmosphere", "./EventManager", "./CookieManager"],
        function(Ext, jQuery, atmosphere, EventManager, CookieManager) {
    "use strict";
 
    var _DEBUG = true;
    
    var _mediator = null;

    var _CONNECTION_CHECK_INTERVAL = 20000;
    var stopConnectionCheck = false;
 
    var ws = null;
 
    var sessionId = null;
 
    var currentUserSessionId = null;
 
    var SUCCESS = "Success";
 
    var NOT_LOGGED_IN = "not_logged_in";
 
    var message = "/mediator";
 
    var topics = []; //maintain a list of topics for reinitialization
 
    var initiated = false;
 
    var socketConnected = false;
 
    var cookies = []; //List of cookies to be added to a request/post. Defined in the core.properties file

    var featureCache = new Map();
    var chatCache = new Map();
 
    function Mediator() {}
    function Logger() {}
    var logger = new Logger();
 
    function init(initTopics) {
 
        _mediator = new Mediator();
 
        var socket = atmosphere;
 
        var request = {
            url: 'mediator',
            contentType : "application/json",
            logLevel : 'debug',
            transport : 'websocket' ,
            trackMessageLength : true,
            reconnectInterval : 5000,
            fallbackTransport: 'websocket',
            maxReconnectOnClose : 17280, //24 hours -- whatever the token expiration is...
            closeAsync: true,//synchronous close call locks IE on connection drop
        };
 
        request.onOpen = function(){
            socketConnected = true;
            if(!initiated){
                initiated = true;
                if(initTopics){
                    _mediator.subscribe(initTopics);
                }
                //Load the config once the websocket is established
                logger.log(" Mediator onOpen initiated setting socketConnected " + socketConnected);
                _mediator.sendMessage({ type: "config" });
            }else{
                logger.log(" Mediator onOpen reconnection setting socketConnected " + socketConnected);
                _mediator.onReconnect();
            }
        };
 
        request.onError = function(error){
            logger.log(" Mediator onError called ");
        };
 
        request.onClose = function(error){
            socketConnected = false;
            logger.log(" Mediator onClose called  setting socketConnected " + socketConnected);
            if (typeof error.messageCode == 'undefined' || error.messageCode != 1000) {
                logger.log(" Mediator signalling disconnect...");
                _mediator.onDisconnect();
            } else {
        		_mediator.doesConnectionExist();
            }
         };
 
        //Adding handler for onClientTimeout to fix 10/1/2019 field test issue
        request.onClientTimeout = function(message){
            logger.log(" Mediator onClientTimeout Will initiate reconnection after reconnectionInterval...");
    		setTimeout(function(){
      			 ws = socket.subscribe(request);
    		}, request.reconnectInterval);
         };
 
        request.onReconnect = function(){
        	logger.log(" Mediator onReconnect called with socketConnected " + socketConnected);
            var onReconnect = 'reconnect';
            _mediator.onReconnect();
        };
 
        request.onReopen = function(){
            //var onReopen = 'reconnect';
            socketConnected = true;
            logger.log(" Mediator onReopen called  setting socketConnected " + socketConnected);
            _mediator.onReopen();
        };
 
        var onResponse = function(response) {
            var responseBody = response.responseBody; //JSON string
            var message = atmosphere.util.parseJSON(responseBody);
            if (message.data != null) {//Check to see if there is data
                if (message.responseType == "json"){
                    try{
                        message.data = JSON.parse(message.data);
                        if (message.data.message == 'OK') {
                			logger.log(" Mediator onResponse event " + message.eventName 
                					+ " with data: " + JSON.stringify(message.data));
                        	
                    		if (message.eventName.indexOf('nics.collabroom.feature.') >= 0) {
                    			_mediator.deleteFeatureCache(message);
                    		}
                    		if (message.eventName.indexOf('chat.proxy.') >= 0) {
                    			_mediator.deleteChatCache(message);
                    		}
                        }
                    } catch(e){} //JS Logging?
                }
                EventManager.fireEvent(message.eventName, message.data);
            }else if(message.errorMessage){
                Ext.MessageBox.alert('Error', message.errorMessage);
            }
        };
 
        request.onMessage = onResponse;
        request.onMessagePublished = onResponse;
 
        ws = socket.subscribe(request);
        
        function connectionCheck()
        {
    		_mediator.doesConnectionExist();
    		if (!stopConnectionCheck)
    			window.setTimeout(connectionCheck, _CONNECTION_CHECK_INTERVAL);
        }
		window.setTimeout(connectionCheck, _CONNECTION_CHECK_INTERVAL);

		// Update the online status icon based on connectivity
        window.addEventListener('online',  
        		function() { 
					stopConnectionCheck = true;
        			logger.logAlways(" Mediator windows event signalling connection alive... ");
        			EventManager.fireEvent("iweb.connection.reconnected", (new Date()).getTime()); 
        			});
        window.addEventListener('offline', 
        		function() { 
					stopConnectionCheck = true;
			  		logger.logAlways(" Mediator windows event signalling connection lost... ");
			  		socketConnected = false;
 			  		_mediator.onDisconnect();
        			});
    };
 
    Logger.prototype.log = function (msg) {
    	if (_DEBUG) { console.log((new Date()).toLocaleString() + msg); }
    }
    Logger.prototype.logAlways = function (msg) {
    	console.log((new Date()).toLocaleString() + msg);
    }
    
    // synchrnous call to check if connection exists
    Mediator.prototype.doesConnectionExist = function () {
        var xhr = new XMLHttpRequest();
        
        var file = "login/images/scout_logo.png";
        var randomNum = Math.round(Math.random() * 10000);
     
        xhr.timeout = 5000; // time in milliseconds
        xhr.open('HEAD', file + "?rand=" + randomNum, true);
        xhr.send();
         
        xhr.addEventListener("readystatechange", processRequest, false);
        function processRequest(e) {
          if (xhr.readyState == 4) {
            if (xhr.status >= 200 && xhr.status < 304) {
              //alert("connection exists!");
    	      EventManager.fireEvent("iweb.connection.reconnected");
			  logger.logAlways(" Mediator doesConnectionExist determined connection alive... ");
            } else {
              //alert("connection doesn't exist!");
              logger.logAlways(" Mediator doesConnectionExist determined connection lost... ");
		  	  socketConnected = false;
  	          EventManager.fireEvent("iweb.connection.disconnected");
            }
          }
        }
    }
    
    Mediator.prototype.onReconnect = function(){
    	logger.log(" Mediator onReconnect prototype called with  socketConnected " + socketConnected); 
    }
    
    Mediator.prototype.onReopen = function() {
        logger.log(" Mediator onReopen prototype called with  socketConnected " + socketConnected);
        featureCache.forEach(function(value, key) {
            if (socketConnected) {
        		logger.log(" Mediator processing message from featureCache "+JSON.stringify(value));
                ws.push(JSON.stringify(value));
            }
        });
        chatCache.forEach(function(value, key) {
            if (socketConnected) {
        		logger.log(" Mediator processing message from chatCache "+JSON.stringify(value));
                ws.push(JSON.stringify(value));
            }
        });
        if (socketConnected) {
            for(var j=0; j<topics.length; j++){
                this.subscribe(topics[j]);
            }
            //Fire reconnect event
            logger.log(" Mediator firing reconnect event ");          
            EventManager.fireEvent("iweb.connection.reconnected", (new Date()).getTime()); 
        }
    };

    Mediator.prototype.onDisconnect = function(){
        EventManager.fireEvent("iweb.connection.disconnected");
    };
 
    Mediator.prototype.close = function(){
    	logger.log(" Mediator close prototype called and inturn unsubscribe");
        atmosphere.unsubscribe();
    };
 
    //Set rest api
    Mediator.prototype.setRestAPI = function(url) {
        this.restApiUrl = url;
    };
 
    //Return configured rest api url
    Mediator.prototype.getRestAPI = function() {
        return this.restApiUrl;
    };
 
    Mediator.prototype.updateFeatureCache = function(message) {
		featureCache.set(message.eventName, message);
    }
    
    Mediator.prototype.deleteFeatureCache = function(message) {
		featureCache.delete(message.eventName);
    }
    
    Mediator.prototype.updateChatCache = function(message) {
    	if (message.payload != undefined) {
    		var payload = JSON.parse(message.payload);
            if (payload.chatid != undefined) {
                chatCache.forEach(function(value, key) {
            		var mapPayload = JSON.parse(value.payload);
            		if (mapPayload.chatid == payload.chatid) {
            			chatCache.delete(key);
            		}
                });
                chatCache.set(message.eventName, message);
            }
    	}
    }
 
    Mediator.prototype.deleteChatCache = function(message) {
		chatCache.delete(message.eventName);
    }
    
    //Send Message on Rabbit Bus
    Mediator.prototype.sendMessage = function(message) {
        logger.logAlways(" Mediator sendMessage " + JSON.stringify(message) + " with  socketConnected " + socketConnected);
    	if (message.eventName != undefined) {
    		if (message.eventName.indexOf('nics.collabroom.feature.') >= 0) {
    			this.updateFeatureCache(message);
    		}
    		if (message.eventName.indexOf('chat.proxy.') >= 0) {
    			this.updateChatCache(message);
    		}
    	}
        if (socketConnected) {
            ws.push(JSON.stringify(message));
            return true;
        }
        return false;
    };

    Mediator.prototype.publishMessage = function(topic, message){
        msg = {
            type: "publish",
            message: JSON.stringify(message),
            topic: topic
        };
        this.sendMessage(msg);
        
    };
 
    //Subscribe to Message Bus
    Mediator.prototype.subscribe = function(topic) {
        if(jQuery.inArray(topic, topics) == -1) { topics.push(topic); }
        msg = { type: "subscribe", topic: topic };
        this.sendMessage(msg);
    };
 
    //Unsubscribe from Message Bus
    Mediator.prototype.unsubscribe = function(topic) {
        var index = jQuery.inArray(topic, topics);
        if(index != -1){ topics.splice(index,1); }
        msg = { type: "unsubscribe", topic: topic };
        this.sendMessage(msg);
    };
 
    // Send delete message to the rest api
    Mediator.prototype.sendDeleteMessage = function(url, eventName, responseType) {
        if(!responseType){
            responseType = 'json';
        }
    	logger.log(
        		' Mediator Attempting to DELETE message to ' + url +
        		' event ' + eventName 
                );
        msg = {
            type: 'delete',
            url: url,
            eventName: eventName,
            responseType: responseType,
            cookieKeys: CookieManager.getCookies(url)
        };
        this.sendMessage(msg);                 
    };
 
    // Send post message to the rest api
    Mediator.prototype.sendPostMessage = function(url, eventName, payload, responseType) {
        if(!responseType){
            responseType = 'json';
        }
    	logger.log(
        		' Mediator Attempting to POST message to ' + url +
        		' event ' + eventName +
                ' with payload:' + JSON.stringify(payload)
                );
        msg = {
            type: 'post',
            url: url,
            eventName: eventName,
            payload: JSON.stringify(payload),
            responseType: responseType,
            cookieKeys: CookieManager.getCookies(url)
        };
        this.sendMessage(msg);        
    };
 
     // Send post message to the rest api
    Mediator.prototype.sendPutMessage = function(url, eventName, payload, responseType) {
        if(!responseType){
            responseType = 'json';
        }
    	logger.log(
        		' Mediator Attempting to PUT message to ' + url +
        		' event ' + eventName +
        		' with payload:' + JSON.stringify(payload)
                );
        msg = {
            type: 'put',
            url: url,
            eventName: eventName,
            payload: JSON.stringify(payload),
            responseType: responseType,
            cookieKeys: CookieManager.getCookies(url)
        };
        this.sendMessage(msg);
    };
 
    //Send request message to rest api
    Mediator.prototype.sendRequestMessage = function(url, eventName, responseType){
        if(!responseType){
            responseType = 'json';
        }
    	logger.log(
        		' Mediator Attempting to sendRequestMessage to ' + url +
        		' event ' + eventName 
                );
        msg = {
            type: "request",
            url: url,
            eventName: eventName,
            responseType: responseType,
            cookieKeys: CookieManager.getCookies(url)
        };
        this.sendMessage(msg);        
    };
 
    Mediator.prototype.setSessionId = function(id){
        sessionId = id;
    };
 
    Mediator.prototype.getSessionId = function(){
        return sessionId;
    };
 
    Mediator.prototype.setReinitalizeUrl = function(url){
        ws.request.url = url;
    };
 
    Mediator.prototype.setCookies = function(url, cookies){
        CookieManager.addCookies(url, cookies);
    };
 
    /*** NEED TO MOVE THIS OUT ***/
    Mediator.prototype.setCurrentUserSessionId = function(id){
        currentUserSessionId = id;
    };
 
    Mediator.prototype.getCurrentUserSessionId = function(){
        return currentUserSessionId;
    };
    /****************************/
 
    return {
        initialize: function(initTopics, callback) {
            init(initTopics, callback);
        },
 
        getInstance: function() {
            if (_mediator) {
                return _mediator;
            }
            //throw not initialized exception
        }
    };
});