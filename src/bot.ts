// how to do want the bot to respond? Basically we should
// - inform the bot of PS_ID and my FRIENDS
// -- use getConnectedPlayersAsync
// -- then FBInstant.setSessionData({  scoutSent:true,   scoutDurationInHours:24});
// - everytime I log on, check all my friends
// -- getSignedPlayerInfoAsync then (query backend and verify using crypto
// - if i have friends then Shout them a message!!
// -- callSendAPI with a bunch of shit
// need to fire up a separate messaging server! (with postgresql)
// remember and stop if user has enough

import request from "request";
import {app} from "./server";

const expectingReasonReply: any = {};

export function setUpBotWebHooks() {
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
  } else if (payload === "ENJOY_NO") {
    response = {
      attachment: {
        payload: {
          buttons: [
            {
              payload: "GAME_SUCKS_REASON_CANT_CONNECT",
              title: "Can't connect",
              type: "postback",
            },
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

// Handles messaging_postbacks events
function handleGamePlay(sender_psid: string, received_gameplay: any) {
  console.log("handleGamePlay");
  delete expectingReasonReply[sender_psid];

  const playerId = received_gameplay.player_id; // Instant Games player id
  const contextId = received_gameplay.context_id;
  const payload = received_gameplay.payload;

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
}

// Sends response messages via the Send API
function callSendAPI(sender_psid: string, response: any) {
  console.log("process.env.PAGES_ACCESS_TOKEN: " + process.env.PAGES_ACCESS_TOKEN);
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
