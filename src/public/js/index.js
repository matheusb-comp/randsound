import SoundPlayer from "./player.js";

const sp = new SoundPlayer();
window.sp = sp;

const audioPing = document.getElementById("ping");

const playSound = (filePath) => {
  audioPing.src = filePath;
  audioPing.load();
  audioPing.play();
};

document.getElementById("btn_ping_play").addEventListener("click", (ev) => {
  audioPing.play();
});

document.getElementById("btn_ping_pause").addEventListener("click", (ev) => {
  audioPing.pause();
});

document.getElementById("btn_sound_1").addEventListener("click", (ev) => {
  playSound("media/test_sound/ping.mp3");
});

document.getElementById("btn_sound_2").addEventListener("click", (ev) => {
  playSound("media/test_sound/drop.mp3");
});
