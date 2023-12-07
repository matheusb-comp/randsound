import SoundPlayer from "./player.js";
import SoundStorage from "./storage.js";

// TODO: Organize
const storage = new SoundStorage();
const player = new SoundPlayer();
window.ss = storage;
window.sp = player;

// player
//   .setup()
//   .then(() => console.log("READY: Sound Player"))
//   .catch(console.error);

//
const btnSaveFiles = document.getElementById("btn-save-files");
const fileNameList = document.getElementById("list-uploaded-files");
const inputFiles = document.getElementById("upload-sound-files");

//
inputFiles.addEventListener("change", (ev) => {
  fileNameList.innerHTML = "";
  btnSaveFiles.disabled = true;

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
  if (files.length) btnSaveFiles.disabled = false;
});

//
btnSaveFiles.addEventListener("click", (ev) => {
  const btn = ev.target;
  if (!inputFiles?.files?.length) return;

  // TODO: Implement real indexedDB "save" async method
  // const fakeSave = () =>
  //   new Promise((res, rej) => {
  //     const ms = Math.floor(Math.random() * 5000);
  //     setTimeout(() => (ms <= 500 ? rej(new Error("FAKE ERROR")) : res()), ms);
  //   });

  //
  const label = btn.innerText;
  btn.innerText = "Saving...";
  btn.disabled = true;
  inputFiles.disabled = true;
  storage
    .addFilesToBucket("single_bucket", inputFiles.files)
    .then(() => {
      fileNameList.innerHTML = "";
      inputFiles.value = "";
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

const btnLoadBucket = document.getElementById("btn-load-bucket");
const btnPlay = document.getElementById("btn-toggle-player");

let loadedBucketFiles = {};

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

btnLoadBucket.addEventListener("click", (ev) => {
  // TODO: Get chosen bucket name from somewhere
  storage
    .getBucketFiles("single_bucket")
    .then((objects) => {
      console.log("chosen bucket:", objects);
      // elements in "objects": { id, bucket, file }

      //
      const all = objects.reduce((acc, o) => ({ ...acc, [o.id]: o.file }), {});
      loadedBucketFiles = all;

      //
      const sounds = objects.map((o) => ({ id: o.id, getBytes }));
      player.setup({ sounds });

      //
      btnPlay.innerText = "PLAY";
      btnPlay.disabled = false;
    })
    .catch();
});

btnPlay.addEventListener("click", (ev) => {
  const btn = ev.target;
  btn.innerText = btn.innerText === "PLAY" ? "STOP" : "PLAY";

  console.log('player status:', player.status);
  if (player.status === "stopped") player.start();
  else player.stopSound();
});

const onStorageReady = () => {
  //
  storage.listBuckets().then((buckets) => {
    const div = document.getElementById("list-buckets");
    div.innerHTML = "";
    for (const b in buckets) {
      let p = document.createElement("p");
      p.innerText = b + ": " + JSON.stringify(buckets[b]);
      div.appendChild(p);
    }

    //
    btnLoadBucket.disabled = false;
  });
};

document.addEventListener("DOMContentLoaded", () => {
  // Asynchronously setup the storage (IndexedDB)
  storage.setup().then(onStorageReady).catch(console.error);
});
