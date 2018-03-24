'use strict';

const { SmartBuffer } = require('smart-buffer');

const BaseParser = require('./base');
const EntryStream = require('./entry-stream');

/*
#define IH_MAGIC  0x27051956  // Image Magic Number
#define IH_NMLEN  32  // Image Name Length

  typedef struct image_header {
    uint32_t  ih_magic;  // Image Header Magic Number
    uint32_t  ih_hcrc;  // Image Header CRC Checksum
    uint32_t  ih_time;  // Image Creation Timestamp
    uint32_t  ih_size;  // Image Data Size
    uint32_t  ih_load;  // Data Load Address
    uint32_t  ih_ep;    // Entry Point Address
    uint32_t  ih_dcrc;  // Image Data CRC Checksum
    uint8_t    ih_os;    // Operating System
    uint8_t    ih_arch;  // CPU architecture
    uint8_t    ih_type;  // Image Type
    uint8_t    ih_comp;  // Compression Type
    uint8_t    ih_name[IH_NMLEN]; // Image Name
  } image_header_t;
*/

const UBOOT_HEADER_SIZE = 64;
const IMAGE_TYPE_MULTI = 4; // multi-file Image

class UbootImageParser extends BaseParser {
  static decodeHeader(header) {
    const sb = SmartBuffer.fromBuffer(header);
    return {
      magic: sb.readUInt32BE(),
      headerCrc: sb.readUInt32BE(),
      timestamp: sb.readUInt32BE(),
      size: sb.readUInt32BE(),
      loadAddress: sb.readUInt32BE(),
      entryPoint: sb.readUInt32BE(),
      dataCrc: sb.readUInt32BE(),
      os: sb.readUInt8(),
      architecture: sb.readUInt8(),
      type: sb.readUInt8(),
      compression: sb.readUInt8(),
      name: sb.readString(32),
    };
  }

  constructor(extractStream) {
    super(extractStream);

    this.header = null;
    this.entries = [];
    this.waiting = false;
    this.padding = 0;
    this.currentEntry = -1;
    this.entryCallback = this.entryCallback.bind(this);

    this.next(UBOOT_HEADER_SIZE, this.parseHeader);
  }

  parseHeader() {
    const { buffer, extractStream } = this;
    let header = null;
    try {
      header = UbootImageParser.decodeHeader(buffer.slice(0, UBOOT_HEADER_SIZE));
    } catch (e) {
      extractStream.emit('error', e);
    }
    buffer.consume(UBOOT_HEADER_SIZE);

    if (header === null) {
      this.next(UBOOT_HEADER_SIZE, this.parseHeader);
    } else {
      this.header = header;
      if (header.type === IMAGE_TYPE_MULTI) {
        this.next(4, this.parseEntryOffset);
      } else {
        this.entries = [{
          index: 0,
          size: header.size,
        }];
        this.parseNextEntry();
      }
    }

    this.continue();
  }

  parseEntryOffset() {
    const { buffer, extractStream } = this;

    let size = null;
    try {
      size = buffer.slice(0, 4).readUInt32BE(0);
    } catch (e) {
      extractStream.emit('error', e);
    }
    buffer.consume(4);

    if (size === null) {
      this.next(UBOOT_HEADER_SIZE, this.parseHeader);
    } else if (size === 0) {
      this.parseNextEntry();
    } else {
      this.entries.push({
        index: this.entries.length,
        size,
      });
      this.next(4, this.parseEntryOffset);
    }

    this.continue();
  }

  parseNextEntry() {
    const { entries, entryCallback, extractStream, offset } = this;

    if (this.padding > 0) {
      this.next(this.padding, this.skipPadding);
      return;
    }

    this.currentEntry += 1;

    if (entries.length <= this.currentEntry) {
      this.next(UBOOT_HEADER_SIZE, this.parseHeader);
      return;
    }

    const entry = entries[this.currentEntry];
    this.entryStream = new EntryStream(extractStream, offset);
    this.waiting = true;

    extractStream.emit('entry', entry, this.entryStream, entryCallback);

    this.padding = ((entry.size + 3) & ~3) - entry.size; // eslint-disable-line no-bitwise

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

  skipPadding() {
    const { buffer } = this;
    buffer.consume(this.padding);
    this.padding = 0;
    this.parseNextEntry();
    this.continue();
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

module.exports = UbootImageParser;
