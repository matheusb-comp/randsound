/**
 * @typedef {Function} GetSoundBytes
 * @param {string} id
 * @param {Object} extra
 * @returns {Promise<ArrayBuffer>}
 */

/**
 * @typedef {Object} SoundData
 * @property {string} id
 * @property {GetSoundBytes} getBytes
 * @property {Object} extra
 */

/**
 * @typedef {Object} SoundPlayerConfig
 * @property {number} playChance
 * @property {number} cycleDuration
 * @property {number} cycleDelta
 */

/**
 * Default config object.
 * Play sound every 30 seconds.
 *
 * @type {SoundPlayerConfig}
 */
export const DEFAULT_CONFIG = Object.freeze({
  playChance: 1,
  cycleDuration: 30000,
  cycleDelta: 0,
});

class SoundPlayer {
  /**
   * @type {string}
   */
  #status;

  /**
   * @type {SoundData[]}
   */
  #sounds;

  /**
   * @type {SoundPlayerConfig}
   */
  #config;

  /**
   * @type {number}
   */
  #playTimeout;

  /**
   * @type {AudioContext}
   */
  #audioCtx;

  /**
   * @type {AudioBufferSourceNode | null}
   */
  #audioNode;

  constructor() {
    this.#setDefaultAttributes();
  }

  get status() {
    return this.#status;
  }

  get isPlaying() {
    return this.status === "playing";
  }

  get isRunning() {
    return this.#playTimeout !== null;
  }

  loadSounds = async (sounds) => {
    // Sounds validation
    const errors = Array.from(sounds).reduce((all, el, i) => {
      const { id, getBytes, extra } = el || {};
      let err = {};
      if (!id) err.id = "ID must be provided.";
      if (typeof getBytes !== "function")
        err.getBytes = "A function to get the sound bytes is required.";
      if (extra && extra?.constructor?.name !== "Object")
        err.extra = "If any extra data is provided, it must be an object.";
      if (Object.keys(err).length) {
        all[i] = Object.assign(all?.[i] || {}, err);
      }
      return all;
    }, {});
    if (Object.keys(errors).length) {
      let err = new TypeError("Invalid sounds (check messages attribute).");
      err.messages = errors;
      throw err;
    }

    // Stop playing and set the new sounds
    await this.stop();
    this.#sounds = Array.from(sounds).map((el) => ({
      id: el.id,
      getBytes: el.getBytes,
      extra: el.extra,
    }));
  };

  loadConfig = async (config) => {
    // Config validation
    const { playChance, cycleDuration, cycleDelta } = config || {};
    let errors = {};
    if (isNaN(playChance) || playChance < 0 || playChance > 1)
      errors.playChance = "Must be a percentage [0,1].";
    if (isNaN(cycleDuration) || cycleDuration < 0)
      errors.cycleDuration = "Must be positive.";
    if (isNaN(cycleDelta) || cycleDelta < 0)
      errors.cycleDelta = "Must be positive.";
    if (Object.keys(errors).length) {
      let err = new TypeError("Invalid config (check messages attribute).");
      err.messages = errors;
      throw err;
    }

    // Stop playing and set the new config
    await this.stop();
    this.#config = {
      playChance: Number(playChance),
      cycleDuration: Math.floor(cycleDuration),
      cycleDelta: Math.floor(cycleDelta),
    };
  };

  stop = async () => {
    this.#saveTimer(null);
    await this.#stopSound();
  };

  start = (delay = 0) => {
    if (this.isRunning) return 0;

    const ms = delay >= 0 ? delay : this.#randInt(5000);
    this.#saveTimer(setTimeout(this.#timerLoop, ms));
    console.debug(`STARTING IN ${ms}ms...`);
    return ms;
  };

  playRandomSound = async () => {
    if (!this.#sounds.length) {
      console.warn("Empty sound list: Impossible to play.");
      return;
    }

    const idx = this.#randInt(this.#sounds.length);
    return await this.playSound(idx);
  };

  playSound = async (idx) => {
    const data = this.#sounds?.[idx];
    if (!data) throw new Error(`Sound at position ${idx} not found.`);

    return await this.#playSound(data);
  };

  #setDefaultAttributes = () => {
    this.#playTimeout = null;
    this.#audioNode = null;
    this.#audioCtx = new AudioContext();
    this.#sounds = [];
    this.#config = DEFAULT_CONFIG;
    this.#status = "stopped";
  };

  #saveTimer = (timer = null) => {
    clearTimeout(this.#playTimeout);
    this.#playTimeout = timer;
  };

  #cleanup = async () => {
    await this.stop();
    await this.#audioCtx?.close().catch(() => {});
    this.#setDefaultAttributes();
  };

  #timerLoop = async () => {
    try {
      // Brother, you gotta roll the dice!
      const lim = this.#config.playChance;
      if (Math.random() <= lim) await this.playRandomSound();

      // Wait some time before trying again...
      const dt = this.#config.cycleDelta;
      const ms = this.#config.cycleDuration + this.#randInt(dt || 1, -1 * dt);
      this.#saveTimer(setTimeout(this.#timerLoop, ms));
      console.debug(`Next sound in ${ms}ms...`);
    } catch (err) {
      // "Finish the cycle of eternal return"
      console.error(err);
      await this.#cleanup();
    }
  };

  #stopSound = async () => {
    this.#audioNode?.stop();
    this.#audioNode = null;
    await this.#audioCtx.suspend().catch(() => {});
    if (this.isPlaying) this.#status = "stopped";
  };

  /**
   * @param {SoundData} soundData
   * @returns {Promise<void>}
   */
  #playSound = async (soundData) => {
    const { id, getBytes, extra = {} } = soundData;
    if (!id || typeof getBytes !== "function") throw new Error("Bad soundData");

    // Change the player status
    if (this.isPlaying) throw new Error("Already playing a sound");
    this.#status = "playing";
    console.debug("Playing sound ID:", id);

    try {
      // Get the bytes from the soundData callback
      const bytes = await Promise.resolve(getBytes(id, extra));
      if (!(bytes instanceof ArrayBuffer)) throw new Error("Bad bytes");

      // Configure an AudioBufferSourceNode and start playing
      this.#audioNode = await this.#playAudioData(bytes);

      // Return a promise that resolves when the sound ends
      return new Promise((resolve) => {
        this.#audioNode.addEventListener("ended", () => {
          this.#stopSound().then(resolve);
        });
      });
    } catch (err) {
      await this.#stopSound();
      throw err;
    }
  };

  /**
   * @param {ArrayBuffer} bytes
   * @returns {Promise<AudioBufferSourceNode>}
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode
   */
  #playAudioData = async (bytes) => {
    // Create the AudioBuffer (designed for small snippets, less than 45s)
    const buffer = await this.#audioCtx.decodeAudioData(bytes);

    // Create the "source" AudioNode and set the buffer
    const source = this.#audioCtx.createBufferSource();
    source.buffer = buffer;

    // Connect the node to the destination (so the sound can be heard)
    source.connect(this.#audioCtx.destination);

    // Make sure the Audio Context is "running" before trying to play
    // https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state
    if (["suspended", "interrupted"].includes(this.#audioCtx.state)) {
      await this.#audioCtx.resume();
    }

    // Play the entire AudioBuffer from the node
    source.start();

    // Schedule the node cleanup
    source.addEventListener("ended", () => {
      source.disconnect();
      source.buffer = null;
    });

    return source;
  };

  #randInt = (max, min = 0) => {
    if (!max || max <= 0) throw new Error("Max randInt must be positive");
    if (min > max) min = max - 1;
    return Math.floor(Math.random() * (max - min)) + min;
  };
}

export default SoundPlayer;
