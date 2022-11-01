require('dotenv-flow').config();
const mysql = require('mysql2');
const fs = require('fs');
const crypto = require('crypto');
const fetch = require('node-fetch');
const sizeOf = require('image-size');
const setTimeoutPromise = require('node:timers/promises').setTimeout;

const MEDIA_TYPE_IMG = 'img';
const MEDIA_TYPE_VIDEO = 'video';
const SLEEP_BETWEEN_BATCHES_MS = 1000;
const SLEEP_BETWEEN_MEDIA_ITEMS_MS = 100;
const BATCH_SIZE = 1000;
const MEDIA_DOWNLOAD_REQUEST_TIMEOUT_MS = 60000;
const START_DOWNLOADING_FROM_DATE = '2022-01-01';

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || 'orbitar',
  database: process.env.MYSQL_DATABASE || 'orbitar_db',
  dir: './backup-media',
  dbFile: './backup-media/index.csv'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const download = async (url, dest, controller) => {
    if (!url.match(/^(\/\/|http:|https:)/)) {
      console.log(`Invalid URL: `, url);
      return false;
    }
    if (url.match(/^\/\//)) {
      url = 'https:' + url;
    }
    try {
      const response = await fetch(url, { signal: controller.signal });
      const responseBinary = await response.buffer();
      let writeResult = await fs.promises.writeFile(dest, responseBinary);
      await sleep(1000);
      console.log(`Wrote ${responseBinary.length} bytes to ${dest} for ${url}`);
      return controller.abort();
    } catch (e) {
      console.log(e);
      return false;
    }
};

const downloadRequestTimeout = async (ms, url, controller) => {
  try {
    await setTimeoutPromise(ms, undefined, { signal: controller.signal });
    controller.abort();
    console.log(`Request to fetch ${url} is aborted due to slow response`);
    return false;
  } catch (error) {
    return false;
  }
};

const connection = mysql.createConnection({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database
});

try {
  fs.mkdirSync(config.dir);
} catch (e) {}
if (!fs.existsSync(config.dbFile)) {
  fs.openSync(config.dbFile, 'w+');
  fs.appendFileSync(config.dbFile, 'item_type,item_id,media_type,media_src,media_id,img_width,img_height  ' + '\n');
} else {
  fs.openSync(config.dbFile, 'w+');
}

const saveEntry = (mediaType, outputPath, outputFilename, mediaSrc, itemType, itemId) => {
  let dimensions = {width: 0, height: 0};
  if (mediaType === MEDIA_TYPE_IMG) {
    try {
      dimensions = sizeOf(outputPath);
    } catch (e) {
    }
  }
  let line = [
    itemType, itemId, mediaType, mediaSrc, outputFilename, dimensions.width, dimensions.height
  ];
  fs.appendFileSync(config.dbFile, line.join(',') + '\n');
};

const processBatch = async (offset) => {
  const result = await connection.promise().query(
    'select * from `content_source` where (`source` like "%<img%" or `source` like "%<video%") and date(created_at) > "' + START_DOWNLOADING_FROM_DATE + '" limit ' + offset + ',' + BATCH_SIZE
  );
  if (!result[0] || !result[0].length) {
    return false;
  }
  for (const entry of result[0]) {
    let itemType = entry.ref_type;
    let itemId = entry.ref_id;
    let entrySource = entry.source;
    const mediaItems = entrySource.match(/<(img|video|source).+src=['"]([^'"]+)['"]/g);
    if (!mediaItems) {
      console.log(`No media items detected: `, entrySource);
      continue;
    }
    console.log(`have ${mediaItems.length} media items`);
    for (const mediaItem of mediaItems) {
      const check = mediaItem.match(/<(img|video|source).+src=['"]([^'"]+)['"]/);
      let mediaSrc = check[2];
      let mediaType = check[1] === MEDIA_TYPE_IMG ? MEDIA_TYPE_IMG : MEDIA_TYPE_VIDEO;
      let mediaExtensionMatch = mediaSrc.match(/\.[a-z]{2,}(?:\?.+)?$/);
      let mediaExtension;
      if (!mediaExtensionMatch) {
        if (mediaType === MEDIA_TYPE_IMG) {
          mediaExtension = '.jpg';
        } else {
          mediaExtension = '.mp4';
        }
      } else {
        mediaExtension = mediaExtensionMatch[0].replace(/\?.+?$/, '');
      }
      let outputFilename = crypto.createHash('sha256').update(mediaSrc).digest('hex') + mediaExtension;
      let outputPath = config.dir + '/' + outputFilename;
      if (fs.existsSync(outputPath)) {
        console.log(outputPath, 'is already there');
        saveEntry(mediaType, outputPath, outputFilename, mediaSrc, itemType, itemId);
      } else {
        console.log(`Processing media item `, mediaSrc);
        try {
          const requestController = new AbortController();
          const requestTimeoutController = new AbortController();
          await Promise.race([downloadRequestTimeout(MEDIA_DOWNLOAD_REQUEST_TIMEOUT_MS, mediaSrc, requestController), download(mediaSrc, outputPath, requestTimeoutController)]);
          console.log(`Done processing media item ${mediaSrc}`);
          saveEntry(mediaType, outputPath, outputFilename, mediaSrc, itemType, itemId);
          await sleep(SLEEP_BETWEEN_MEDIA_ITEMS_MS);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
  return result[0].length;
};

(async () => {
  try {
    const result = await connection.promise().query(
      'select count(*) as total from `content_source` where (`source` like "%<img%" or `source` like "%video%") and date(created_at) > "' + START_DOWNLOADING_FROM_DATE + '" '
    );
    console.log('Content sources with media:', result[0][0].total);
    console.log('Start processing');
    let offset = 0;
    while (true) {
      let processed = await processBatch(offset);
      console.log(`Batch of ${processed} entries is done`);
      if (processed < BATCH_SIZE) {
        break;
      }
      offset += processed;
      await sleep(SLEEP_BETWEEN_BATCHES_MS);
    }
  } catch (e) {
    console.log(`error happened`, e);
  } finally {
    console.log(`done`);
    connection.end();
    process.exit(0);
  }
})();
