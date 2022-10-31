require('dotenv-flow').config();
const mysql = require('mysql2');
const fs = require('fs');
const crypto = require('crypto');
const fetch = require('node-fetch');
const sizeOf = require('image-size');
const setTimeoutPromise = require('node:timers/promises').setTimeout;

const cancelRequest = new AbortController();
const cancelTimeout = new AbortController();

const MEDIA_TYPE_IMG = 'img';
const MEDIA_TYPE_VIDEO = 'video';
const SLEEP_BETWEEN_BATCHES_MS = 1000;
const BATCH_SIZE = 10;
const MEDIA_DOWNLOAD_REQUEST_TIMEOUT_MS = 10;

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || 'orbitar',
  database: process.env.MYSQL_DATABASE || 'orbitar_db',
  dir: './backup-media',
  dbFile: './backup-media/index.csv'
};

const sleep = async (ms) => {
  return setTimeoutPromise(ms);
};

const downloadRequestTimeout = async (ms) => {
  try {
    await setTimeoutPromise(ms, undefined, { signal: cancelTimeout.signal });

    cancelRequest.abort();
    console.log(`Timeout done, aborting request`);
    return 1;
  } catch (error) {
    return 2;
  }

  throw new Error(`Request aborted as it took longer than ${ms}ms`);
}

const download = (url, dest) => {
  return new Promise((resolve) => {
    if (!url.match(/^(\/\/|http:|https:)/)) {
      console.log(`Invalid URL: `, url);
      resolve(3);
      return;
    }
    if (url.match(/^\/\//)) {
      url = 'https:' + url;
    }
    try {
      fetch(url, { signal: cancelRequest.signal }).then((res) => res.buffer()).then((responseBinary) => {
        fs.writeFileSync(dest, responseBinary);
        resolve(4);
      });
    } catch (e) {} finally {
      cancelTimeout.abort();
      resolve(5);
    }
  });
};

const connection = mysql.createConnection({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database
});

try {
  fs.mkdirSync(config.dir);
} catch (e) {
}
if (!fs.existsSync(config.dbFile)) {
  fs.openSync(config.dbFile, 'w+');
  fs.appendFileSync(config.dbFile, 'item_type,item_id,media_type,media_src,media_id,img_width,img_height  ' + '\n');
} else {
  fs.openSync(config.dbFile, 'w+');
}

const saveEntry = function(mediaType, outputPath, outputFilename, mediaSrc, itemType, itemId) {
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
}

const processBatch = (offset) => {
  return new Promise((resolve) => {
    connection.promise().query(
      'select * from `content_source` where (`source` like "%<img%" or `source` like "%<video%") and date(created_at) > "2022-10-21" limit ' + offset + ',' + BATCH_SIZE
    ).then(async (result) => {
      if (!result[0] || !result[0].length) {
        resolve(0);
        return;
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
            console.log(`Processing item `, mediaSrc);
            try {
              const result = await Promise.race([downloadRequestTimeout(MEDIA_DOWNLOAD_REQUEST_TIMEOUT_MS), download(mediaSrc, outputPath)]);
              console.log(`Done processing ${mediaSrc}: `, result);
            } catch (e) {
              console.error(e);
            }
          }
        }
      }

      resolve(result[0].length);
    });
  });
}

(async () => {
  try {
    const result = await connection.promise().query(
      'select count(*) as total from `content_source` where (`source` like "%<img%" or `source` like "%video%") and date(created_at) > "2022-10-21" '
    );
    console.log('Content sources with media: ', result[0][0].total);
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
