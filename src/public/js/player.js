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

class SoundPlayer {
  #status;
  #config;
  /**
   * @type {AudioContext}
   */
  #audioCtx;
  #playTimeout;

  constructor() {
    this.#cleanup();
  }

  get status() {
    return this.#status;
  }

  get #el() {
    const id = this.#config.dom_id;
    const element = document.getElementById(id);
    if (!element) throw new Error(`DOM: <audio> element #${id} not found`);
    return element;
  }

  setup = async (config) => {
    // TODO: Validate config
    this.#cleanup();

    this.#status = "stopped";
    this.#audioCtx = new AudioContext();
    this.#config = { ...config };
  };

  start = () => {
    this.#checkSetup();

    const ms = this.#randInt(5000);
    this.#saveTimer(setTimeout(this.#timerLoop, ms));
    console.debug(`STARTING IN ${ms}ms...`);
  };

  #cleanup = () => {
    this.#saveTimer();
    this.#audioCtx?.close().catch(() => {});

    this.#status = "waiting_setup";
    this.#audioCtx = null;
    this.#config = {};
  };

  #checkSetup = () => {
    if (this.status === "waiting_setup") {
      throw new Error("Please call setup first");
    }
  };

  #saveTimer = (timer = null) => {
    clearTimeout(this.#playTimeout);
    this.#playTimeout = timer;
  };

  #timerLoop = async () => {
    try {
      // Execute the loop iteration
      this.#checkSetup();
      await this.playRandomSound();

      // Schedule the next loop iteration
      const ms = this.#randInt(60000);
      const timer = setTimeout(this.#timerLoop, ms);
      this.#saveTimer(timer);
      console.debug(`Next sound in ${ms}ms...`);
    } catch (err) {
      // "Finish the cycle of eternal return"
      console.error(err);
      this.#cleanup();
    }
  };

  playRandomSound = async () => {
    this.#checkSetup();

    const { sounds } = this.#config;
    if (!sounds?.length) throw new Error("Empty sound list");

    const data = sounds[this.#randInt(sounds.length)];
    return await this.#playSound(data);
  };

  /**
   * @param {SoundData} soundData
   * @returns {Promise<void>}
   */
  #playSound = async (soundData) => {
    const { id, getBytes, extra = {} } = soundData;
    if (!id || typeof getBytes !== "function") throw new Error("Bad soundData");

    // Change the player status
    const oldStatus = this.#status;
    if (oldStatus === "playing") throw new Error("Already playing a sound");
    this.#status = "playing";
    console.debug("Playing sound ID:", id);

    try {
      // Get the bytes from the soundData callback
      const bytes = await Promise.resolve(getBytes(id, extra));
      if (!(bytes instanceof ArrayBuffer)) throw new Error("Bad bytes");

      // Configure an AudioBufferSourceNode and start playing
      const audioNode = await this.#playAudioData(bytes);

      // Return a promise that resolves when the sound ends
      return new Promise((resolve) => {
        audioNode.addEventListener("ended", () => {
          if (this.#status === "playing") this.#status = oldStatus;
          resolve();
        });
      });
    } catch (err) {
      if (this.#status === "playing") this.#status = oldStatus;
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
    this.#checkSetup();

    // Create the AudioBuffer (designed for small snippets, less than 45s)
    const buffer = await this.#audioCtx.decodeAudioData(bytes);

    // Create the "source" AudioNode and set the buffer
    const source = this.#audioCtx.createBufferSource();
    source.buffer = buffer;

    // Connect the node to the destination (so the sound can be heard)
    source.connect(this.#audioCtx.destination);

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
