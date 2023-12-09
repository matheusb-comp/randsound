class SoundStorage {
  /**
   * @type {IDBDatabase | null}
   */
  #idb;
  #dbName;
  #storeName;

  constructor() {
    this.#idb = null;
    this.#dbName = "soundLibrary";
    this.#storeName = "soundFiles";
  }

  get #db() {
    if (!this.#idb) throw new Error("Please call setup first");
    return this.#idb;
  }

  setup = async () => {
    this.#idb = await this.#open(this.#dbName);
    this.#idb.addEventListener("error", (err) => {
      console.error("SoundStorage error:", err);
    });
  };

  findFile = (id) =>
    new Promise((resolve, reject) => {
      // Transaction handlers
      const tx = this.#db.transaction([this.#storeName], "readonly");
      tx.addEventListener("error", (ev) => reject(ev.target.error));

      // Get a single object by ID
      tx.objectStore(this.#storeName)
        .get(id)
        .addEventListener("success", (ev) => resolve(ev.target.result));
    });

  addFilesToBucket = (bucket, files, extraData = []) =>
    new Promise((resolve, reject) => {
      let res = [];

      // Transaction handlers
      const tx = this.#db.transaction([this.#storeName], "readwrite");
      tx.addEventListener("error", (ev) => reject(ev.target.error));
      tx.addEventListener("complete", () => resolve(res));

      // Add each file and save the returned ID
      const store = tx.objectStore(this.#storeName);
      Array.from(files).forEach((file, i) =>
        store.add({ bucket, file }).addEventListener("success", (ev) =>
          res.push({
            id: ev.target.result,
            bucket,
            file,
            extra: extraData?.[i] || {},
          })
        )
      );
    });

  // TODO: Implement "Update files" (change bucket or file, needs to pass an ID)

  // TODO: Implement "Delete files" (single ID or entire bucket)

  listBuckets = () =>
    new Promise((resolve, reject) => {
      let res = {};

      // Transaction handlers
      const tx = this.#db.transaction([this.#storeName], "readonly");
      tx.addEventListener("error", (ev) => reject(ev.target.error));

      // Build a map { <bucket_name>: id[] } for the object store
      tx.objectStore(this.#storeName)
        .index("bucket")
        .openKeyCursor()
        .addEventListener("success", (ev) => {
          const cursor = ev.target.result;
          if (!cursor) return resolve(res);
          res[cursor.key] = [...(res[cursor.key] || []), cursor.primaryKey];
          cursor.continue();
        });
    });

  getBucketFiles = (bucket) =>
    new Promise((resolve, reject) => {
      // Transaction handlers
      const tx = this.#db.transaction([this.#storeName], "readonly");
      tx.addEventListener("error", (ev) => reject(ev.target.error));

      // Get all files in a bucket
      tx.objectStore(this.#storeName)
        .index("bucket")
        .getAll(bucket)
        .addEventListener("success", (ev) => resolve(ev.target.result));
    });

  deleteBucketFiles = (bucket) =>
    new Promise((resolve, reject) => {
      let res = 0;

      // Transaction handlers
      const tx = this.#db.transaction([this.#storeName], "readwrite");
      tx.addEventListener("error", (ev) => reject(ev.target.error));

      // Delete all elements in the key index (<key,primaryKey>)
      const store = tx.objectStore(this.#storeName);
      store
        .index("bucket")
        .openKeyCursor(bucket)
        .addEventListener("success", (ev) => {
          const cursor = ev.target.result;
          if (!cursor) return resolve(res);
          store.delete(cursor.primaryKey);
          res++;
          cursor.continue();
        });
    });

  /**
   *
   * @param {string} dbName
   * @param {number | undefined} version
   * @returns {Promise<IDBDatabase>}
   */
  #open = (dbName, version) =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, version);
      req.addEventListener("error", (ev) => reject(ev.target.error));
      req.addEventListener("success", (ev) => resolve(ev.target.result));
      req.addEventListener("upgradeneeded", (ev) => {
        const { target, newVersion, oldVersion } = ev;
        const db = this.#upgrade(target.result, newVersion, oldVersion);
        resolve(db);
      });
    });

  /**
   *
   * @param {IDBDatabase} db
   * @param {number} newVersion
   * @param {number} oldVersion
   * @returns {Promise<IDBDatabase>}
   */
  #upgrade = (db, newVersion, oldVersion) =>
    new Promise((resolve) => {
      if (newVersion > 1) throw new Error(`Invalid IDB version ${newVersion}`);
      console.debug(`SoundStorage IDB upgrade: ${oldVersion} => ${newVersion}`);

      /**
       * The object store will hold files with the structure:
       * `{ bucket, name, type, size, lastModified, bytes (blob) }`
       * Where the `bucket` is used to make separate "lists of files"
       */
      const store = db.createObjectStore(this.#storeName, {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("bucket", "bucket", { unique: false });

      // Resolve the promise when the object store creation completes
      store.transaction.addEventListener("complete", () => resolve(db));
    });
}

export default SoundStorage;
