/**
 * ANI MARKET - Pure JS ZIP Generator (Store method, no external deps)
 * Permet de générer un fichier ZIP téléchargeable dans le navigateur en Mode Export.
 */
class SimpleZip {
  constructor() {
    this.files = [];
  }

  // Ajoute un fichier texte ou binaire (Uint8Array / ArrayBuffer / string)
  add(name, content) {
    let data;
    if (typeof content === 'string') {
      data = new TextEncoder().encode(content);
    } else if (content instanceof ArrayBuffer) {
      data = new Uint8Array(content);
    } else if (content instanceof Uint8Array) {
      data = content;
    } else {
      throw new Error('Type de contenu non supporté');
    }
    this.files.push({ name, data });
  }

  // Calcul du CRC32
  static crc32(buf) {
    if (!SimpleZip.table) {
      const table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
          c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
      }
      SimpleZip.table = table;
    }
    const table = SimpleZip.table;
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  buildBlob() {
    const parts = [];
    const cdEntries = [];
    let offset = 0;

    const date = new Date();
    const dosTime = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xFFFF;

    for (const f of this.files) {
      const nameBytes = new TextEncoder().encode(f.name);
      const crc = SimpleZip.crc32(f.data);
      const size = f.data.length;

      // Local Header (30 octets)
      const lHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(lHeader.buffer);
      lv.setUint32(0, 0x04034b50, true); // Local header signature
      lv.setUint16(4, 20, true);         // Version needed
      lv.setUint16(6, 0x0800, true);     // Flags (UTF-8)
      lv.setUint16(8, 0, true);          // Compression = 0 (Store)
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);      // Compressed size
      lv.setUint32(22, size, true);      // Uncompressed size
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);         // Extra field length
      lHeader.set(nameBytes, 30);

      parts.push(lHeader);
      parts.push(f.data);

      // Préparation du Central Directory Header (46 octets)
      const cdHeader = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(cdHeader.buffer);
      cdv.setUint32(0, 0x02014b50, true); // Central header signature
      cdv.setUint16(4, 20, true);         // Version made by
      cdv.setUint16(6, 20, true);         // Version needed
      cdv.setUint16(8, 0x0800, true);     // Flags (UTF-8)
      cdv.setUint16(10, 0, true);         // Compression = 0
      cdv.setUint16(12, dosTime, true);
      cdv.setUint16(14, dosDate, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, size, true);
      cdv.setUint32(24, size, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint16(30, 0, true);         // Extra len
      cdv.setUint16(32, 0, true);         // Comment len
      cdv.setUint16(34, 0, true);         // Disk start
      cdv.setUint16(36, 0, true);         // Internal attr
      cdv.setUint32(38, 0, true);         // External attr
      cdv.setUint32(42, offset, true);    // Offset of local header
      cdHeader.set(nameBytes, 46);

      cdEntries.push(cdHeader);
      offset += lHeader.length + size;
    }

    const cdOffset = offset;
    let cdSize = 0;
    for (const entry of cdEntries) {
      parts.push(entry);
      cdSize += entry.length;
    }

    // End of Central Directory Record (22 octets)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, this.files.length, true);
    ev.setUint16(10, this.files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdOffset, true);
    ev.setUint16(20, 0, true);
    parts.push(eocd);

    return new Blob(parts, { type: 'application/zip' });
  }
}

if (typeof window !== 'undefined') {
  window.SimpleZip = SimpleZip;
}
