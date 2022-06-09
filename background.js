var isStatusSet = false;

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("Extension loaded");

  if (request.message == "Content Loaded. Watch this tab!") {
    queryTabsInWindow();
    sendResponse("All set! Watching this tab.");
  }

  if (request.message == "Set Slack status") {
    setSlackStatus();
    sendResponse("Slack status set!");
  }

  if (request.message == "Clear Slack status") {
    clearSlackStatus();
    sendResponse("Slack status cleared!");
  }
});


chrome.webRequest.onCompleted.addListener(function () {
  if (isStatusSet) {
    console.log("Successfully intercepted network request. Clearing slack status")
    clearSlackStatus();
  }
  else {
    console.log("Successfully intercepted network request. Setting slack status")
    setSlackStatus();
  }
}, { urls: ["https://meet.google.com/$rpc/google.rtc.meetings.v1.MeetingDeviceService/UpdateMeetingDevice"] })

function queryTabsInWindow() {
  chrome.tabs.query({ url: "https://meet.google.com/*" }, function (tabs) {
    tabs.forEach(function (tab) {
      let tabId = tab.id;
      chrome.tabs.onRemoved.addListener(function (tabid, removed) {
        if (tabId === tabid) {
          var raw = {
            profile: {
              status_text: "",
              status_emoji: "",
              status_expiration: 0,
            },
          };
          clearSlackStatus();
        }
      });
    });
  });
}

function setSlackStatus() {
  let emoji = "📞";
  let text = "On a meet call • Reply may be delayed";
  chrome.storage.sync.get(["emojiText", "statusText"], function (result) {
    if (result.emojiText) {
      // https://stackoverflow.com/questions/18862256/how-to-detect-emoji-using-javascript
      if (/\p{Emoji}/u.test(result.emojiText)) {
        emoji = result.emojiText;
        console.log('One char emoji')
      }
      else if (/^\:.*\:$/.test(result.emojiText)) {
        emoji = result.emojiText;
        console.log('Custom emoji with both colons')
      }
      else {
        emoji = ":" + result.emojiText + ":";
        console.log('Custom emoji without both colons')
      }
    }
    if (result.statusText) {
      text = result.statusText;
    }

    var raw = JSON.stringify({
      profile: {
        status_text: text,
        status_emoji: emoji,
        status_expiration: 0,
      },
    });

    makeSlackAPICall(raw, "set");
    isStatusSet = true;
  });
}

function clearSlackStatus() {
  var raw = JSON.stringify({
    profile: {
      status_text: "",
      status_emoji: "",
      status_expiration: 0,
    },
  });

  makeSlackAPICall(raw, "clear");
  isStatusSet = false;
}


function makeSlackAPICall(raw, type) {
  var key;
  chrome.storage.sync.get(["meetSlackKey"], function (result) {

    if (result.meetSlackKey) {
      key = result.meetSlackKey;

      var myHeaders = new Headers();
      myHeaders.append(
        "Authorization",
        `Bearer ${key}`
      );
      myHeaders.append("Content-Type", "application/json");

      var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
      };

      fetch("https://slack.com/api/users.profile.set", requestOptions)
        .then((response) => response.text())
        .then((result) => console.log("Slack status altered"))
        .catch((error) => console.log("error", error));
    }
  });
}
