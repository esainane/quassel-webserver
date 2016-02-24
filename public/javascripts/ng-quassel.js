/*
 * ngSocket.js
 * https://github.com/chrisenytc/ng-socket
 *
 * Copyright (c) 2013 Christopher EnyTC, David Prothero
 * Licensed under the MIT license.
 */

// Module Copyright (c) 2013 Michael Benford

// Module for provide Socket.io support

/* global quasselconf */
/* global angular */

(function () {
  'use strict';

  angular.module('ngQuassel', []).provider('$quassel', socketProvider);

  function socketProvider() {
    var Quassel = require('quassel');
    
    this.$get = [socketFactory];

    function socketFactory() {
      this.quassel = null;
      this.server = '';
      this.port = '';
      this.login = '';
      this.password = '';
      this.ws = null;
      this._ws_cb = [];
      var self = this;
      
      var service = {
        addListener: addListener,
        on: addListener,
        once: addListenerOnce,
        removeListener: removeListener,
        removeAllListeners: removeAllListeners,
        emit: emit,
        setServer: setServer,
        'get': getQuassel,
        markBufferAsRead: markBufferAsRead,
        moreBacklogs: moreBacklogs,
        sendMessage: sendMessage,
        requestDisconnectNetwork: requestDisconnectNetwork,
        requestConnectNetwork: requestConnectNetwork,
        requestRemoveBuffer: requestRemoveBuffer,
        requestMergeBuffersPermanently: requestMergeBuffersPermanently,
        requestUpdate: requestUpdate,
        connect: connect,
        createIdentity: createIdentity,
        createNetwork: createNetwork,
        disconnect: disconnect,
        login: login,
        requestUnhideBuffer: requestUnhideBuffer,
        requestHideBufferPermanently: requestHideBufferPermanently,
        requestHideBufferTemporarily: requestHideBufferTemporarily
      };

      return service;
      
      function setServer(_server, _port, _login, _password) {
        self.server = _server;
        self.port = _port;
        self.login = _login;
        self.password = _password;
        self.quassel.server = self.server;
        self.quassel.port = self.port;
      }
      
      function getQuassel() {
        return self.quassel;
      }
      
      ////////////////////////////////

      function initializeSocket() {
        //Check if socket is undefined
        if (self.quassel === null) {
          var net = require('net');
          net.setProxy({
              path: window.location.pathname + 'p',
          });
          self.quassel = new Quassel(self.server, self.port, {
              nobacklogs: quasselconf.initialBacklogLimit === 0,
              initialbackloglimit: quasselconf.initialBacklogLimit || 20,
              backloglimit: quasselconf.backlogLimit || 50,
              unsecurecore: quasselconf.unsecurecore || false // tls-browserify module doesn't respect tls API of nodejs
          }, function(next) {
              next(self.login, self.password);
              var istls = !quasselconf.unsecurecore;
              if (istls) {
                self.ws = self.quassel.qtsocket.socket._socket._ws;
              } else {
                self.ws = self.quassel.qtsocket.socket._ws;
              }
              triggerWebsocketBindings();
          });
        }
      }

      function angularCallback(callback) {
        return function () {
          if (callback) {
            var args = arguments;
            callback.apply(self.quassel, args);
          }
        };
      }

      function addListener(name, scope, callback) {
        initializeSocket();

        if (arguments.length === 2) {
          scope = null;
          callback = arguments[1];
        }
        
        if (name.substr(0, 3) == "ws.") {
          self._ws_cb.push({name: name.substr(3), callback: callback, active: false});
          triggerWebsocketBindings();
        } else {
          self.quassel.on(name, angularCallback(callback));
        }

        if (scope !== null) {
          scope.$on('$destroy', function () {
            removeListener(name);
          });
        }
      }

      function addListenerOnce(name, callback) {
        initializeSocket();
        self.quassel.once(name, angularCallback(callback));
      }

      function removeListener(name) {
        initializeSocket();
        if (name.substr(0, 3) == "ws.") {
          self.ws.removeEventListener(name.substr(3));
        } else {
          self.quassel.removeListener(name);
        }
      }

      function removeAllListeners(name) {
        initializeSocket();
        self.quassel.removeAllListeners(name);
      }

      function emit(name, data, callback) {
        initializeSocket();
        if (typeof callback === 'function') {
            self.quassel.emit(name, data, angularCallback(callback));
        } else {
            self.quassel.emit.apply(self.quassel, Array.prototype.slice.call(arguments));
        }
      }
      
      function markBufferAsRead(bufferId, lastMessageId) {
        self.quassel.requestSetLastMsgRead(bufferId, lastMessageId);
        self.quassel.requestMarkBufferAsRead(bufferId);
        self.quassel.requestSetMarkerLine(bufferId, lastMessageId);
      }
      
      function moreBacklogs(bufferId, firstMessageId) {
        self.quassel.requestBacklog(bufferId, -1, firstMessageId, 50);
      }
      
      function sendMessage(bufferId, message) {
        self.quassel.sendMessage(bufferId, message);
      }
      
      function requestDisconnectNetwork(networkId) {
        self.quassel.requestDisconnectNetwork(networkId);
      }
      
      function requestConnectNetwork(networkId) {
        self.quassel.requestConnectNetwork(networkId);
      }
      
      function requestRemoveBuffer(bufferId) {
        self.quassel.requestRemoveBuffer(bufferId);
      }
      
      function requestMergeBuffersPermanently(bufferId1, bufferId2) {
        self.quassel.requestMergeBuffersPermanently(bufferId1, bufferId2);
      }
      
      function requestUnhideBuffer(bufferId) {
        self.quassel.requestUnhideBuffer(bufferId);
      }
      
      function requestHideBufferTemporarily(bufferId) {
        self.quassel.requestHideBufferTemporarily(bufferId);
      }
      
      function requestHideBufferPermanently(bufferId) {
        self.quassel.requestHideBufferPermanently(bufferId);
      }
      
      function requestUpdate(ignoreList) {
        self.quassel.requestUpdate(ignoreList);
      }
      
      function connect() {
        self.quassel.connect();
      }

      function createIdentity(nick) {
        self.quassel.createIdentity(nick);
      }

      function createNetwork(name, domain, identity) {
        self.quassel.createNetwork(name, domain, identity);
      }

      function disconnect() {
        self.quassel.disconnect();
      }
      
      function login() {
        self.quassel.login();
      }
      
      function triggerWebsocketBindings() {
        if (self.ws !== null) {
          var i = 0;
          for (; i<self._ws_cb.length; i++) {
            if (self._ws_cb[i].active === false) {
              self.ws.addEventListener(self._ws_cb[i].name, self._ws_cb[i].callback);
              self._ws_cb[i].active = true;
            }
          }
        }
      }
    }
  }

})();
