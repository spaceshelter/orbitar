require('dotenv-flow').config();
const mysql = require('mysql2');
const fs = require('fs');
const crypto = require('crypto');
const fetch = require('node-fetch');
const sizeOf = require('image-size');

const MEDIA_TYPE_IMG = 'img';
const MEDIA_TYPE_VIDEO = 'video';
const SLEEP_BETWEEN_BATCHES_MS = 1000;
const BATCH_SIZE = 1000;
const MEDIA_DOWNLOAD_REQUEST_TIMEOUT_MS = 120000;

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || 'orbitar',
  database: process.env.MYSQL_DATABASE || 'orbitar_db',
  dir: './backup-media',
  dbFile: './backup-media/index.csv',
  lastProcessedIdFile: './backup-media/id.txt'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const download = async (url, dest, signal) => {
    if (!url.match(/^(\/\/|http:|https:)/)) {
      console.log(`Invalid URL: ${url}`);
      return false;
    }
    if (url.match(/^\/\//)) {
      url = 'https:' + url;
    }
    try {
      const response = await fetch(url, { signal });
      const responseBinary = await response.buffer();
      let writeResult = await fs.promises.writeFile(dest, responseBinary);
      await sleep(1000);
      console.log(`Wrote ${responseBinary.length} bytes to ${dest} for ${url}`);
      return true;
    } catch (e) {
      console.log(e);
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
  fs.writeFileSync(config.dbFile, 'type,content_source_id,media_type,media_src,media_id,img_width,img_height  ' + '\n');
}

if (!fs.existsSync(config.lastProcessedIdFile)) {
  fs.writeFileSync(config.lastProcessedIdFile, '0');
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
  fs.writeFileSync(config.lastProcessedIdFile, itemId.toString());
};

const processBatch = async (startWithId) => {
  const result = await connection.promise().query(
    `select 
        cs.content_source_id,
        coalesce(p.html, c.html) as html,
        cs.ref_type,
        cs.ref_id
    from
        content_source cs
    left join comments c on c.content_source_id = cs.content_source_id
    left join posts p on p.content_source_id = cs.content_source_id
    where
        (p.html like '%<img%' or c.html like '%<img%' or
         p.html like '%<video%' or c.html like '%<video%') and cs.content_source_id > ${startWithId}
    order by cs.content_source_id asc
    limit ${BATCH_SIZE}`
  );
  if (!result[0] || !result[0].length) {
    return [false];
  }
  let itemId;
  for (const entry of result[0]) {
    itemId = entry.content_source_id;
    let itemType = entry.ref_type;
    let entryHtml = entry.html;
    const mediaItems = entryHtml.match(/<(img|video|source).+src=['"]([^'"]+)['"]/g);
    if (!mediaItems) {
      console.log(`No media items detected: `, entryHtml);
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
          const controller = new AbortController();
          const succeeded = await Promise.race([
            download(mediaSrc, outputPath, controller.signal),
            sleep(MEDIA_DOWNLOAD_REQUEST_TIMEOUT_MS)
          ]);
          if (succeeded) {
            console.log(`Done processing media item!`);
            saveEntry(mediaType, outputPath, outputFilename, mediaSrc, itemType, itemId);
          } else {
            console.log(`Timeout processing media item!`);
            controller.abort();
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
  return [result[0].length, itemId];
};

(async () => {
  let lastProcessedId = parseInt(fs.readFileSync(config.lastProcessedIdFile).toString(), 10);
  try {
    console.log('Start processing');
    while (true) {
      let [processedCount, lastBatchProcessedId] = await processBatch(lastProcessedId);
      if (lastBatchProcessedId) {
        console.log(`Batch of ${processedCount} is done, last processed item id: ${lastBatchProcessedId}`);
      }
      if (processedCount < BATCH_SIZE) {
        break;
      }
      lastProcessedId = lastBatchProcessedId;
      await sleep(SLEEP_BETWEEN_BATCHES_MS);
    }
  } catch (e) {
    console.log(`error happened`, e);
  } finally {
    console.log(`done`);
    connection.end();
    process.exit();
  }
})();
