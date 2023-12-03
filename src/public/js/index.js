import SoundPlayer from "./player.js";
import SoundStorage from "./storage.js";

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
  const fakeSave = () => new Promise((res, rej) => {
    const ms = Math.floor(Math.random() * 5000);
    setTimeout(() => ms <= 500 ? rej(new Error('FAKE ERROR')) : res(), ms);
  });

  //
  const label = btn.innerText;
  btn.innerText = "Salvando...";
  btn.disabled = true;
  inputFiles.disabled = true;
  fakeSave(inputFiles.files)
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

// TODO: Organize
const sp = new SoundPlayer();
const ss = new SoundStorage();
window.sp = sp;
window.ss = ss;

// const audioPing = document.getElementById("ping");

// const playSound = (filePath) => {
//   audioPing.src = filePath;
//   audioPing.load();
//   audioPing.play();
// };

// document.getElementById("btn_ping_play").addEventListener("click", (ev) => {
//   audioPing.play();
// });

// document.getElementById("btn_ping_pause").addEventListener("click", (ev) => {
//   audioPing.pause();
// });

// document.getElementById("btn_sound_1").addEventListener("click", (ev) => {
//   playSound("media/test_sound/ping.mp3");
// });

// document.getElementById("btn_sound_2").addEventListener("click", (ev) => {
//   playSound("media/test_sound/drop.mp3");
// });
