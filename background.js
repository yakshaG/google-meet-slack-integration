let keepAlive;



chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message == "Extension status 200") {
    sendResponse("RESET ON PAGE LOAD");
    console.log(keepAlive)
    clearInterval(keepAlive);
    keepAlive = setInterval(() => {
      console.log("SW alive!")
    }, 5000);

    if (chrome.webRequest.onCompleted.hasListeners()) {
      console.log("RESET ON PAGE LOAD: Some webRequest event listeners are active on initial page load. Removing them.")
      chrome.webRequest.onCompleted.removeListener(joinMeetingCallback);
      chrome.webRequest.onCompleted.removeListener(exitMeetingCallback);
    }
  }

  if (request.message == "Watch for meeting join") {
    sendResponse("Watching for meeting join");
    console.log("Registered meeting join listener")
    chrome.webRequest.onCompleted.addListener(joinMeetingCallback, { urls: ["https://meet.google.com/hangouts/v1_meetings/media_streams/add?key=*"] })
  }

  if (request.message == "Extension status 400") {
    sendResponse("Noted extension is under maintainence");
    console.log("Doing nothing as extension status is 400")
    return;
  }
});





function joinMeetingCallback() {
  console.log("Successfully intercepted network request. Setting slack status.")
  setSlackStatus();
  setTimeout(() => {
    console.log("Registering meeting exit listener and tabs listener after 1s.")
    chrome.webRequest.onCompleted.addListener(exitMeetingCallback, { urls: ["https://meet.google.com/$rpc/google.rtc.meetings.v1.MeetingDeviceService/UpdateMeetingDevice", "https://meet.google.com/v1/spaces/*/devices:close?key=*"] })
    queryTabsInWindow();
    chrome.webRequest.onCompleted.removeListener(joinMeetingCallback);
  }, 1000);
}

function exitMeetingCallback() {
  console.log("Successfully intercepted network request. Clearing slack status.")
  clearSlackStatus();
  chrome.webRequest.onCompleted.removeListener(exitMeetingCallback);
  clearInterval(keepAlive);
}

function queryTabsInWindow() {
  chrome.tabs.query({ url: "https://meet.google.com/*" }, function (tabs) {
    tabs.forEach(function (tab) {
      let tabId = tab.id;
      // https://stackoverflow.com/a/3107221
      chrome.tabs.onRemoved.addListener(function tabsListenerCallback(tabid, removed) {
        if (tabId === tabid) {
          console.log("Successfully intercepted tab close. Clearing slack status")
          clearSlackStatus();
          clearInterval(keepAlive);
        }
        chrome.tabs.onRemoved.removeListener(tabsListenerCallback);
      });
    });
  });
}


function setSlackStatus() {
  let emoji = "????";
  let text = "On a meet call ??? Reply may be delayed";
  chrome.storage.sync.get(["emojiText", "statusText"], function (result) {
    if (result.emojiText) {
      // https://stackoverflow.com/questions/18862256/how-to-detect-emoji-using-javascript
      if (/\p{Emoji}/u.test(result.emojiText)) {
        emoji = result.emojiText;
        // console.log('One char emoji')
      }
      else if (/^\:.*\:$/.test(result.emojiText)) {
        emoji = result.emojiText;
        // console.log('Custom emoji with both colons')
      }
      else {
        emoji = ":" + result.emojiText + ":";
        // console.log('Custom emoji without both colons')
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
        .then((result) => {
          // console.log("Slack status altered")
        })
        .catch((error) => console.log("error", error));
    }
  });
}