// how to do want the bot to respond? Basically we should
// - inform the bot of PS_ID and my FRIENDS (done)
// -- use getConnectedPlayersAsync (done)
// -- then FBInstant.setSessionData({  scoutSent:true,   scoutDurationInHours:24}); (done)
// -- EVERYTIME SOMEONE IS HERE LOG THEIR sender_psid to their game id (done)
// - everytime I log on, check all my friends
// -- getSignedPlayerInfoAsync then (query backend and verify using crypto
// - if i have friends then Shout them a message!! (DONE)
// -- callSendAPI with a bunch of shit (DONE)

import CryptoJS from "crypto-js";
import {Client} from "pg";
import request from "request";
import {app} from "./server";

// tslint:disable-next-line
const hstore = require('pg-hstore')()

const expectingReasonReply: any = {};
const STOP_ASKING_TABLE = "stopasking";
const PLAYER_INFO_TABLE = "playerinfo";
const FRIEND_GRAPH = "friendnames";

function sendToFriendImPlaying(target_psid: string, senderPlayerID: string, contextID: string) {
  const game_metadata: any = {
    player_id: senderPlayerID,
  };
  if (contextID) {
    game_metadata.context_id = contextID;
  }

  let response;
  response = { text: "fffffff" };
  // response = {
  //   attachment: {
  //     payload: {
  //       elements: [{
  //         buttons: [{
  //             game_metadata,
  //             payload: "paaayyyyyloooooad",
  //             title: "Play MiniSquadron!",
  //             type: "game_play",
  //         }],
  //         image_url: "https://petersfancybrownhats.com/company_image.png",
  //         subtitle: "This is a freakign subtitle.",
  //         title: "This is TITLE!",
  //       }],
  //       template_type: "generic",
  //       text: "Your friend is playing MiniSquadron! Join now!",
  //     },
  //     type: "template",
  //   },
  // };
  callSendAPI(target_psid, response);
}

export function setUpBotWebHooks() {
  app.get("/sayhitofriends", (req: any, res: any) => {
    // const signedRequest = req.query.signedRequest;

    // let firstpart = signedRequest.split(".")[0];
    // firstpart = firstpart.replace(/-/g, "+").replace(/_/g, "/");
    // const signature = CryptoJS.enc.Base64.parse(firstpart).toString();
    // const dataHash = CryptoJS.HmacSHA256(signedRequest.split(".")[1], '<APP_SECRET>').toString();
    // const isValid = signature === dataHash;
    // const json = CryptoJS.enc.Base64.parse(request.split('.')[1]).toString(CryptoJS.enc.Utf8);
    // const data = JSON.parse(json);

    // console.log(validated); // this will be true if the request is verified as coming from the game
    // console.log(data); // a JSON object as follows:

    /*
    {
      algorithm: 'HMAC-SHA256',
      issued_at: 1517294566,
      player_id: '1114685845316172',
      request_payload: 'custom_payload_supplied_with_request'
    }
    */

    const playerID = req.query.playerID;
    const contextID = req.query.contextID;
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    client.connect(function(err) {
      if (err) {
        console.log(err);
      } else {
        client.query("SELECT friend_playerids FROM " + FRIEND_GRAPH + " WHERE playerid=($1)", [playerID],
        function(qerr, result) {
          if (qerr) {
            console.error(qerr);
          } else {
            if (result.rowCount === 0) {
              console.log("no friends");
              client.end();
            } else {
              hstore.parse(result.rows[0].friend_playerids, function(hstore_map_playerids_to_names: any) {
                console.log(hstore_map_playerids_to_names);
                const playerids = Object.keys(hstore_map_playerids_to_names);
                console.log("playerids:");
                console.log(playerids);
                client.query("select playerid, psid from " + PLAYER_INFO_TABLE + " where playerid = ANY ($1::TEXT[]);",
                [playerids], function(qqerr, qqresult) {
                  if (qqerr) {
                    console.error(qqerr);
                  } else {
                    console.log("sending to some friends...");
                    console.log(qqresult.rows);
                    for (const row of qqresult.rows) {
                      const playerid = row.playerid;
                      const psid = row.psid;
                      const playername = hstore_map_playerids_to_names[playerid];
                      console.log("sending message to " + playerid + ", " + psid + ", " + playername);

                      // const response = {
                      //   text: "Your friend + " + playername + " is playing!",
                      // };
                      // callSendAPI("1580944105350275", response);
                    }
                    sendToFriendImPlaying("1580944105350275", playerID, contextID); // sending to myself now
                  }
                  client.end();
                });
              });
            }
          }
        });
      }
    });
    res.sendStatus(200);
  });

  // Adds support for GET requests to our webhook
  app.get("/webhook", (req: any, res: any) => {
    // Your verify token. Should be a random string.
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    // Parse the query params
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
      // Checks the mode and token sent is correct
      if (mode === "subscribe" && token === VERIFY_TOKEN) {

        // Responds with the challenge token from the request
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);

      } else {
        // Responds with '403 Forbidden' if verify tokens do not match
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(403);
    }
  });
  app.post("/webhook", (req: any, res: any) => {

    const body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === "page") {

      // Iterates over each entry - there may be multiple if batched
      body.entry.forEach(function(entry: any) {
        // Gets the message. entry.messaging is an array, but
        // will only ever contain one message, so we get index 0
        const webhook_event = entry.messaging[0];
        console.log(webhook_event);

        // Get the sender PSID
        const sender_psid = webhook_event.sender.id;
        console.log("Sender PSID: " + sender_psid);

        // Check if the event is a message or postback and
        // pass the event to the appropriate handler function
        if (webhook_event.message) {
          handleMessage(sender_psid, webhook_event.message);
        } else if (webhook_event.postback) {
          handlePostback(sender_psid, webhook_event.postback);
        } else if (webhook_event.game_play) {
          handleGamePlay(sender_psid, webhook_event.game_play);
        }
      });

      // Returns a '200 OK' response to all requests
      res.status(200).send("EVENT_RECEIVED");
    } else {
      // Returns a '404 Not Found' if event is not from a page subscription
      res.sendStatus(404);
    }
  });
}

// Handles messages events
function handleMessage(sender_psid: string, received_message: any) {
  let response: any;

  // Check if the message contains text
  if (received_message.text) {

    if (expectingReasonReply.hasOwnProperty(sender_psid) && expectingReasonReply[sender_psid]) {
      response = {
        text: "Thanks for your feedback! I will improve the game!",
      };

      delete expectingReasonReply[sender_psid];
    } else {
      // Create the payload for a basic text message
      // response = {
      //   text: "You sent the message: " + received_message.text + ". Now send me an image!",
      // };
    }
  } else if (received_message.attachments) {

    // // Gets the URL of the message attachment
    // const attachment_url = received_message.attachments[0].payload.url;
    // response = {
    //   attachment: {
    //     payload: {
    //       elements: [{
    //         buttons: [
    //           {
    //             payload: "yes",
    //             title: "Yes!",
    //             type: "postback",
    //           },
    //           {
    //             payload: "no",
    //             title: "No!",
    //             type: "postback",
    //           },
    //         ],
    //         image_url: attachment_url,
    //         subtitle: "Tap a button to answer.",
    //         title: "Is this the right picture?",
    //       }],
    //       template_type: "generic",
    //     },
    //     type: "template",
    //   },
    // };
  }

  // Sends the response message
  callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid: string, received_postback: any) {
  console.log("handlePostback");
  let response;

  // Get the payload for the postback
  const payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === "yes") {
    response = { text: "Thanks!" };
  } else if (payload === "no") {
    response = { text: "Oops, try sending another image." };
  } else if (payload === "ENJOY_YES") {
    response = { text: "Thanks we love you!" };
  } else if (payload === "ENJOY_STOP_ASKING") {
    response = { text: "OK I'm gonna shut up! Feel free to post your thoughts \
to https://www.facebook.com/minisquadron.online and let me know!" };

    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    client.connect(function(err) {
      client.query("INSERT INTO " + STOP_ASKING_TABLE + " VALUES($1)", [sender_psid], function(qerr, result) {
        if (qerr) {
          console.error(qerr);
        } else {
          // people do nothing
        }
        client.end();
      });
    });

  } else if (payload === "ENJOY_NO") {
    response = {
      attachment: {
        payload: {
          buttons: [
            {
              payload: "GAME_SUCKS_REASON_LATENCY_BAD",
              title: "Poor connectivity",
              type: "postback",
            },
            {
              payload: "GAME_SUCKS_REASON_CANT_CONTROL",
              title: "Difficult to control",
              type: "postback",
            },
            {
              payload: "GAME_SUCKS_REASON_OTHER",
              title: "Other reason",
              type: "postback",
            },
          ],
          template_type: "button",
          text: "Oh! :( Please let me know why...I can guess...",
        },
        type: "template",
      },
    };
  } else if (payload === "GAME_SUCKS_REASON_LATENCY_BAD" ||
             payload === "GAME_SUCKS_REASON_CANT_CONNECT" ||
             payload === "GAME_SUCKS_REASON_CANT_CONTROL") {
    response = { text: "Thanks for letting me know :) I will improve! Feel free to post more thoughts \
to https://www.facebook.com/minisquadron.online and let me know!" };
  } else if (payload === "GAME_SUCKS_REASON_OTHER") {
    expectingReasonReply[sender_psid] = true;
    response = { text: "So sorry to hear :( Feel free to post your thoughts \
to https://www.facebook.com/minisquadron.online and let me know!" };
  }

  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

function writeFriendsToDB(playerID: string, connectedPlayers: any) {

  const connectedPlayersPlayerIDs: any = [];
  const connectedPlayersNames: any = [];
  for (const pid in connectedPlayers) {
    if (connectedPlayers.hasOwnProperty(pid)) {
      connectedPlayersPlayerIDs.push(pid);
      connectedPlayersNames.push(connectedPlayers[pid]);
    }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  client.connect(function(err) {
    client.query("UPDATE " + FRIEND_GRAPH +
                " SET friend_playerids = friend_playerids || hstore($1::TEXT[],$2::TEXT[]) WHERE playerid=($3)",
                [connectedPlayersPlayerIDs, connectedPlayersNames, playerID], function(qerr, result) {
      if (qerr) {
        console.error(qerr);
      } else {
        // check to see what results are back
        if (result.rowCount === 0) { // need to insert please
          client.query("INSERT INTO " + FRIEND_GRAPH + " VALUES($1,hstore($2::TEXT[],$3::TEXT[]))",
          [playerID, connectedPlayersPlayerIDs, connectedPlayersNames], function(qqerr, rresult) {
            if (qqerr) {
              console.error(qqerr);
            } else {
              // do nothing
              console.log("New friends INSERT success!");
            }
            client.end();
          });
        } else {
          console.log("Old friends UPDATE success!");
          client.end();
        }
      }
    });
  });
}

function recordPSID(playerID: string, psid: string) {
  // record in database
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  client.connect(function(err) {
    client.query("INSERT INTO " + PLAYER_INFO_TABLE + " VALUES($1,$2) ON CONFLICT (playerid) DO \
UPDATE SET psid = ($2) WHERE " + PLAYER_INFO_TABLE + ".psid != ($2)",
    [playerID, psid], function(qerr, result) {
      if (qerr) {
        console.error(qerr);
      } else {
        if (result.rowCount === 0) {
          console.log("No change in playerinfo psid");
        } else {
          console.log("Inserted or updated playerinfo psid");
        }
      }
      client.end();
    });
  });
}

// Handles messaging_postbacks events
function handleGamePlay(sender_psid: string, received_gameplay: any) {
  console.log("handleGamePlay");
  delete expectingReasonReply[sender_psid];

  const playerId = received_gameplay.player_id; // Instant Games player id
  const contextId = received_gameplay.context_id;
  const payload = received_gameplay.payload;

  recordPSID(playerId, sender_psid);

  if (payload) {
    const payloadJSON = JSON.parse(payload);
    if (payloadJSON.connectedPlayers) {
      writeFriendsToDB(playerId, payloadJSON.connectedPlayers);
    }
  }

  // should we even ask?
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  client.connect(function(err) {
    client.query("SELECT sender_psid FROM " + STOP_ASKING_TABLE + " WHERE sender_psid=($1)", [sender_psid],
    function(qerr, result) {
      if (qerr) {
        console.error(qerr);
      } else {
        if (result.rowCount === 0) {
          // ok we can do this
          let response;
          response = {
            attachment: {
              payload: {
                buttons: [
                  {
                    payload: "ENJOY_YES",
                    title: "Yes it was fun!",
                    type: "postback",
                  },
                  {
                    payload: "ENJOY_NO",
                    title: "Not really.",
                    type: "postback",
                  },
                  {
                    payload: "ENJOY_STOP_ASKING",
                    title: "Stop asking!",
                    type: "postback",
                  },
                ],
                template_type: "button",
                text: "Thanks for playing! Please help me improve this game - did you enjoy your game just now?",
              },
              type: "template",
            },
          };

          callSendAPI(sender_psid, response);
        } else {
          // people do nothing
        }
      }
      client.end();
    });
  });
}

// Sends response messages via the Send API
function callSendAPI(sender_psid: string, response: any) {
  // Construct the message body
  const request_body = {
    message: response,
    recipient: {
      id: sender_psid,
    },
  };

  // Send the HTTP request to the Messenger Platform
  request({
    json: request_body,
    method: "POST",
    qs: { access_token: process.env.PAGES_ACCESS_TOKEN },
    uri: "https://graph.facebook.com/v2.6/me/messages",
  }, (err, res, body) => {
    if (!err) {
      console.log("message sent!");
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}
