import SoundPlayer from "./player.js";
import SoundStorage from "./storage.js";

const storage = new SoundStorage();
const player = new SoundPlayer();
window.ss = storage;
window.sp = player;

//
const formUploadSoundFiles = document.getElementById("form-upload-sound-files");
const fileNameList = document.getElementById("up-sound-file-list");
const inputFiles = document.getElementById("up-sound-files");

const formChooseBucket = document.getElementById("form-choose-bucket");
const formConfigPlayer = document.getElementById("form-config-player");
const btnPlay = document.getElementById("btn-toggle-player");

let loadedBucketFiles = {};

//
inputFiles.addEventListener("change", (ev) => {
  const form = ev.target.form;
  form.submit.disabled = true;
  fileNameList.innerHTML = "";

  //
  const files = ev.target.files;
  for (const f of files) {
    let p = document.createElement("p");
    p.innerText = `${f.name} (${f.type})\n -> size: ${Math.floor(
      f.size / 1024
    )}KB`;
    fileNameList.appendChild(p);
  }

  //
  if (files.length) form.submit.disabled = false;
});

//
formUploadSoundFiles.addEventListener("submit", (ev) => {
  ev.preventDefault();

  const form = ev.target;
  if (!form.sound_files.files?.length) return;

  //
  const btn = form.submit;
  const label = btn.innerText;
  const bucketName = form.bucket_name.value;
  btn.innerText = "Saving...";
  btn.disabled = true;
  inputFiles.disabled = true;
  storage
    .addFilesToBucket(bucketName, inputFiles.files)
    .then(() => {
      fileNameList.innerHTML = "";
      inputFiles.value = "";
      return listSoundBuckets();
    })
    .catch((err) => {
      console.error(err);
      btn.disabled = false;
    })
    .finally(() => {
      btn.innerText = label;
      inputFiles.disabled = false;
    });
});

//////

const readFileAsArrayBuffer = (file, signal = null) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    signal?.addEventListener("abort", () => reader.abort());
    reader.addEventListener("abort", () => reject(signal?.reason));
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsArrayBuffer(file);
  });

const getBytes = async (id) => {
  const file = loadedBucketFiles[id];
  if (!file || !(file instanceof Blob)) {
    throw new Error(`Invalid file ${id} in loaded bucket`);
  }

  // TODO: Get an AbortController's signal from somewhere
  return await readFileAsArrayBuffer(file);
};

formChooseBucket.addEventListener("submit", (ev) => {
  ev.preventDefault();

  //
  const form = ev.target;
  const bucketName = form.bucket.value;
  if (!bucketName) return console.warn("Empty bucket name chosen.");

  // TODO: Get chosen bucket name from somewhere
  storage
    .getBucketFiles(bucketName)
    .then((objects) => {
      console.log("chosen bucket:", bucketName, "obj:", objects);
      // elements in "objects": { id, bucket, file }

      //
      const all = objects.reduce((acc, o) => ({ ...acc, [o.id]: o.file }), {});
      loadedBucketFiles = all;

      //
      const sounds = objects.map((o) => ({ id: o.id, getBytes }));
      player.loadSounds(sounds).catch((err) => {
        console.error(err);
        console.error("messages:", err.messages);
      });

      //
      btnPlay.innerText = "PLAY";
      btnPlay.disabled = false;
    })
    .catch();
});

formConfigPlayer.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const cfg = {
    playChance: form.play_chance.value,
    cycleDuration: form.cycle_duration.value,
    cycleDelta: form.cycle_delta.value,
  };

  form.submit.disabled = true;
  player
    .loadConfig(cfg)
    .then(() => {
      //
      btnPlay.innerText = "PLAY";
      btnPlay.disabled = false;
    })
    .catch((err) => {
      console.error(err);
      console.error("messages:", err.messages);
    })
    .finally(() => {
      form.submit.disabled = false;
    });
});

btnPlay.addEventListener("click", (ev) => {
  console.log("BTN-PLAY - player status:", player.status);
  const btn = ev.target;
  btn.disabled = true;
  Promise.resolve(player.isRunning ? player.stop() : player.start()).finally(
    () => {
      btn.innerText = btn.innerText === "PLAY" ? "STOP" : "PLAY";
      btn.disabled = false;
    }
  );
});

const listSoundBuckets = () => {
  //
  storage.listBuckets().then((buckets) => {
    const div = document.getElementById("list-buckets");
    formChooseBucket.bucket.innerHTML =
      '<option value="">Choose bucket</option>';
    div.innerHTML = "";
    for (const b in buckets) {
      //
      let o = document.createElement("option");
      o.value = b;
      o.text = b;
      formChooseBucket.bucket.appendChild(o);
      //
      let p = document.createElement("p");
      p.innerText = b + ": " + JSON.stringify(buckets[b]);
      let trash = document.createElement("button");
      trash.type = "button";
      trash.innerText = "X";
      trash.dataset.bucketName = b;
      trash.addEventListener("click", (ev) => {
        const btn = ev.target;
        const { bucketName } = btn.dataset || {};
        console.log("btn:", btn, "bucketName:", bucketName);
        const ok = window.confirm(`Confirm deleting bucket ${bucketName}?`);
        if (ok)
          storage.deleteBucketFiles(bucketName).then(() => {
            btn.parentElement?.remove();
          });
      });
      p.appendChild(trash);
      div.appendChild(p);
    }

    //
    formChooseBucket.submit.disabled = false;
  });
};

document.addEventListener("DOMContentLoaded", () => {
  // Asynchronously setup the storage (IndexedDB)
  storage.setup().then(listSoundBuckets).catch(console.error);
});
