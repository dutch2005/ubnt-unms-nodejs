'use strict';

const { SmartBuffer } = require('smart-buffer');

const BaseParser = require('./base');
const EntryStream = require('./entry-stream');

/*
typedef struct
{
  unsigned short crc; // 2
  unsigned short tag1; // 2
  unsigned long tag2; // 4

  unsigned long num_entries; // 4 Number of OPR and tgz files in the STK image (may be 0)

  unsigned long file_size; // 4 Total number of bytes in the STK file

  unsigned char rel; // 1
  unsigned char ver; // 1
  unsigned char maint_level; // 1
  unsigned char build_num; // 1

  unsigned long stk_header_size; // 4 Number of bytes in the STk header

  unsigned long ubnt_build_num; // 4

  unsigned char ubnt_release_type; // 1

  unsigned char ubnt_release_revision; // 1

  unsigned char reserved[58]; // 58   Reserved for future use

} stkFileHeader_t; // 88 total

typedef struct
{
  unsigned long  offset; Offset of first byte of the OPR file from the start of STK file.
  unsigned long  target_device;
  unsigned long  os;     Operating system of this image
  unsigned long  image_flags; flags for BSP specific checking
  unsigned char  reserved[12]; Reserved for future use

} stkOprFileInfo_t; // 28 total
*/

const STK_HEADER_SIZE = 88;
const STK_FILE_HEADER_SIZE = 28;

class StkParser extends BaseParser {
  static decodeHeader(header) {
    const sb = SmartBuffer.fromBuffer(header);
    return {
      crc: sb.readUInt16BE(),
      tag1: sb.readUInt16BE(),
      tag2: sb.readUInt32BE(),
      entriesCount: sb.readUInt32BE(),
      fileSize: sb.readUInt32BE(),
      version: {
        major: sb.readUInt8(),
        minor: sb.readUInt8(),
        patch: sb.readUInt8(),
        build: sb.readUInt8(),
      },
      headerSize: sb.readUInt32BE(),
      buildNumber: sb.readUInt32BE(),
      releaseType: sb.readUInt8(),
      releaseRev: sb.readUInt8(),
    };
  }

  static decodeEntriesHeaders(headers, entriesCount, fileSize) {
    const sb = SmartBuffer.fromBuffer(headers);
    const entries = [];
    let lastEntry = null;

    for (let i = 0; i < entriesCount; i += 1) {
      const component = {
        index: i,
        offset: sb.readUInt32BE(),
        size: 0,
        targetDevice: sb.readUInt32BE(),
        os: sb.readUInt32BE(),
        flags: sb.readUInt32BE(),
      };
      sb.skip(12); // skip reserved bytes
      if (lastEntry !== null) {
        lastEntry.size = component.offset - lastEntry.offset;
      }
      lastEntry = component;
      entries.push(lastEntry);
    }

    lastEntry.size = fileSize - lastEntry.offset;

    return entries;
  }

  constructor(extractStream) {
    super(extractStream);

    this.header = null;
    this.entries = [];
    this.waiting = false;
    this.currentEntry = -1;
    this.entryCallback = this.entryCallback.bind(this);

    this.next(STK_HEADER_SIZE, this.parseHeader);
  }

  parseHeader() {
    const { buffer, extractStream } = this;
    let header = null;
    try {
      header = StkParser.decodeHeader(buffer.slice(0, STK_HEADER_SIZE));
    } catch (e) {
      extractStream.emit('error', e);
    }
    buffer.consume(STK_HEADER_SIZE);

    if (header === null || header.entriesCount <= 0) {
      this.next(STK_HEADER_SIZE, this.parseHeader);
    } else {
      this.header = header;
      this.next(STK_FILE_HEADER_SIZE * header.entriesCount, this.parseEntriesHeaders);
    }

    this.continue();
  }

  parseEntriesHeaders() {
    const { buffer, header, extractStream } = this;

    const size = STK_FILE_HEADER_SIZE * header.entriesCount;
    let entries = null;
    try {
      entries = StkParser.decodeEntriesHeaders(buffer.slice(0, size), header.entriesCount, header.fileSize);
    } catch (e) {
      extractStream.emit('error', e);
    }
    buffer.consume(size);

    if (entries === null || entries.length === 0) {
      this.next(STK_HEADER_SIZE, this.parseHeader);
    } else {
      this.entries = entries;
      this.parseNextEntry();
    }

    this.continue();
  }

  parseNextEntry() {
    const { entries, entryCallback, extractStream, offset } = this;
    this.currentEntry += 1;

    if (entries.length <= this.currentEntry) {
      this.next(STK_HEADER_SIZE, this.parseHeader);
      return;
    }

    const entry = entries[this.currentEntry];
    this.entryStream = new EntryStream(extractStream, offset);
    this.waiting = true;

    extractStream.emit('entry', entry, this.entryStream, entryCallback);

    this.next(entry.size, this.entryEnd);
  }

  entryCallback(error) {
    if (error) {
      this.extractStream.destroy(error);
    } else if (this.waiting) {
      this.waiting = false;
    } else {
      this.parseNextEntry();
      this.continue();
    }
  }

  entryEnd() {
    this.entryStream = null;
    if (!this.waiting) {
      this.parseNextEntry();
      this.continue();
    }
    this.waiting = false;
  }
}

module.exports = StkParser;
