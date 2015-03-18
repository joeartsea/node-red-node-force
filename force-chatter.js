/**
 * Copyright 2014 Atsushi Kojo.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
  'use strict';
  var jsforce = require('jsforce');
  var request = require('request');

  function ForceChatterInNode(n) {
    RED.nodes.createNode(this, n);
    this.force = n.force;
    this.operation = n.operation;
    this.group = n.group;
    this.query = n.query;
    this.mention = n.mention;
    this.forceConfig = RED.nodes.getNode(this.force);

    if (this.forceConfig) {
      var node = this;
      node.on('input', function (msg) {
        this.sendMsg = function (err, result) {
          if (err) {
            node.error(err.toString());
            node.status({ fill: 'red', shape: 'ring', text: 'failed' });
          }
          node.status({});
          msg.payload = result;
          node.send(msg);
        };
        this.forceConfig.login(function (conn) {
          switch (node.operation) {
            case 'get_feed':
              conn.chatter.resource("/feeds/news/me/feed-elements").retrieve(node.sendMsg);
              break;
            case 'get_group':
              var url = "/feeds/record/" + node.group + "/feed-elements";
              conn.chatter.resource(url).retrieve(node.sendMsg);
              break;
            case 'search_feed':
              conn.chatter.resource('/feed-elements', { q: node.query }).retrieve(node.sendMsg);
              break;
            case 'post_feed':
              var feedItem = {
                  body: {
                    messageSegments: []
                  },
                  feedElementType : 'FeedItem',
                  subjectId: msg.topic || 'me'
                };
              var mentions = node.mention.split(",");
              for(var i=0; i<mentions.length; i++){
                if(mentions[i]){
                  feedItem.body.messageSegments.push({
                    type: 'Mention',
                    id: mentions[i]
                  });
                  feedItem.body.messageSegments.push({
                    type: 'Text',
                    text: '\n'
                  });
                }
              }
              feedItem.body.messageSegments.push({
                type: 'Text',
                text: msg.payload
              });
              conn.chatter.resource('/feed-elements').create(feedItem, node.sendMsg);
              break;
          }
        });
      });
    } else {
      this.error('missing force configuration');
    }
  }
  RED.nodes.registerType('force-chatter in', ForceChatterInNode);


  RED.httpAdmin.get('/force-chatter/get-groups', function(req, res) {
    var forceCredentials = RED.nodes.getCredentials(req.query.credentials);
    var forceNode = RED.nodes.getNode(req.query.id);
    if (!req.query.id || !req.query.credentials || !forceCredentials || !forceNode) {
      return res.send('{"error": "Missing force credentials"}');
    }

    forceNode.forceConfig.login(function (conn) {
      conn.chatter.resource("/users/me/groups").retrieve(
        function (err, result) {
          if (err) {
            return res.send('{"error": "error:' + err.toString() + '"}');
          }
          res.send(result);
      });
    });
  });


  RED.httpAdmin.get('/force-chatter/get-mentions', function(req, res) {
    var forceCredentials = RED.nodes.getCredentials(req.query.credentials);
    var forceNode = RED.nodes.getNode(req.query.id);
    if (!req.query.id || !req.query.credentials || !forceCredentials || !forceNode) {
      return res.send('{"error": "Missing force credentials"}');
    }

    forceNode.forceConfig.login(function (conn) {
      var resData = {"success": true};
      conn.chatter.resource("/users").retrieve(
        function (err, result) {
          if (err) {
            return res.send('{"error": "error:' + err.toString() + '"}');
          }
          resData.users = result;
          
          conn.chatter.resource("/groups").retrieve(
            function (err, result) {
              if (err) {
                return res.send('{"error": "error:' + err.toString() + '"}');
              }
              resData.groups = result;
              res.send(resData);
          });
      });
    });
  });

}