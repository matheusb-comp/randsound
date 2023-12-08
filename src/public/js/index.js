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
const formUploadSoundFiles = document.getElementById("form-upload-sound-files");
const fileNameList = document.getElementById("up-sound-file-list");
const inputFiles = document.getElementById("up-sound-files");

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

const formChooseBucket = document.getElementById("form-choose-bucket");
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

formChooseBucket.addEventListener("submit", (ev) => {
  ev.preventDefault();

  //
  const form = ev.target;
  const bucketName = form.bucket.value;

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

  console.log("player status:", player.status);
  if (player.status === "stopped") player.start();
  else player.stopSound();
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
