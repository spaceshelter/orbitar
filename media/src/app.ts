import {config} from './config';
import fs from 'fs';
import crypto from 'crypto';
import mysql, { RowDataPacket } from 'mysql2/promise';
import sizeOf from 'image-size';
import fetch from 'node-fetch';

const MEDIA_DOWNLOAD_REQUEST_TIMEOUT_MS = 120000;

enum MediaType {
  IMG = 'img',
  VIDEO = 'video'
}

enum ItemType {
  COMMENT = 'comment',
  POST = 'post'
}

interface IContentSourceItem extends RowDataPacket {
  content_source_id: number;
  html: string;
  ref_type: ItemType.COMMENT | ItemType.POST;
  ref_id: number;
}

if (!fs.existsSync(config.dbFile)) {
  console.log(`Db file is not there, creating ${config.dbFile}`);
  fs.writeFileSync(config.dbFile, 'type,content_source_id,media_type,media_src,media_id,img_width,img_height  ' + '\n');
}

if (!fs.existsSync(config.lastProcessedIdFile)) {
  console.log(`Last processed id file is not there, creating ${config.lastProcessedIdFile}`);
  fs.writeFileSync(config.lastProcessedIdFile, '0');
}

let lastProcessedId = parseInt(fs.readFileSync(config.lastProcessedIdFile).toString(), 10);
console.log(`Starting with ID ${lastProcessedId}`);

const saveEntry = (
  mediaType: MediaType,
  outputPath: string,
  outputFilename: string,
  mediaSrc: string,
  itemType: ItemType,
  itemId: number
) => {
  let dimensions = {width: 0, height: 0};
  if (mediaType === MediaType.IMG) {
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

const hideUrl = (url: string): string => {
  try {
    // parse url
    const parsedUrl = new URL(url);

    // replace second half of the characters in the string with asterisks
    const hideChars = (str: string) => {
      if (!str) {
        return str;
      }
      const half = Math.ceil(str.length / 2);
      return str.substring(0, half) + '*'.repeat(str.length - half);
    }

    parsedUrl.username = hideChars(parsedUrl.username);
    parsedUrl.password = hideChars(parsedUrl.password);
    parsedUrl.hash = hideChars(parsedUrl.hash);
    if (parsedUrl.pathname) {
      // preserve the extension if any
      const ext = parsedUrl.pathname.match(/^(.*)(\.\w+)$/);
      if (ext) {
        parsedUrl.pathname = hideChars(ext[1]) + ext[2];
      } else {
        parsedUrl.pathname = hideChars(parsedUrl.pathname);
      }
    }
    parsedUrl.search = hideChars(parsedUrl.search);
    return parsedUrl.toString();
  } catch (e) {
    return url;
  }
}

const download = async (
  url: string,
  dest: string,
  signal: AbortSignal
): Promise<boolean> => {
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
    await fs.promises.writeFile(dest, responseBinary);
    console.log(`Wrote ${responseBinary.length} bytes to ${dest} for ${hideUrl(url)}`);
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
};

(async () => {
  const connection = await mysql.createConnection({
    host: config.mysql.host,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database
  });

  const handler = async (startWithId: number) => {
    const [rows] = await connection.query<IContentSourceItem[]>(
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
      limit ${config.batchSize}`
    );

    let itemId = startWithId;
    for (const entry of rows) {
      itemId = entry.content_source_id;
      let itemType = entry.ref_type as ItemType;
      let entryHtml = entry.html;
      const mediaItems = entryHtml.match(/<(img|video|source).+src=['"]([^'"]+)['"]/g);
      if (!mediaItems) {
        console.log(`No media items detected: `, entryHtml);
        continue;
      }
      console.log(`Content source id:${itemId} has ${mediaItems.length} media items`);
      for (const mediaItem of mediaItems) {
        const check = mediaItem.match(/<(img|video|source).+src=['"]([^'"]+)['"]/);
        let mediaSrc = check[2];
        //  starts with data:
        if (mediaSrc.match(/^data:/)) {
          continue;
        }
        let mediaType = check[1] as MediaType;
        let mediaExtensionMatch = mediaSrc.match(/\.[a-z]{2,}(?:\?.+)?$/);
        let mediaExtension;
        if (!mediaExtensionMatch) {
          if (mediaType === MediaType.IMG) {
            mediaExtension = '.jpg';
          } else {
            mediaExtension = '.mp4';
          }
        } else {
          mediaExtension = mediaExtensionMatch[0].replace(/\?.+?$/, '');
        }
        const outputFilename = crypto.createHash('sha256').update(mediaSrc).digest('hex') + mediaExtension;
        const outputPath = '/app/data/' + outputFilename;

        if (fs.existsSync(outputPath)) {
          console.log(outputPath, 'is already there');
          saveEntry(mediaType, outputPath, outputFilename, mediaSrc, itemType, itemId);
        } else {
          console.log(`Processing media item `, hideUrl(mediaSrc));
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
    setTimeout(() => {
      handler(itemId);
    }, config.intervalMs);
  }
  setTimeout(() => {
    handler(lastProcessedId);
  }, config.intervalMs);
})();
