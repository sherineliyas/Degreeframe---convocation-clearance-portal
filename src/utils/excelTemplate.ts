// Pure TypeScript OpenXML (.xlsx) Multi-Sheet Workbook Generator
// Generates a genuine 3-Tab Excel Workbook (DegreeFrame_Master_Sheet_Template.xlsx)
// containing:
//   Tab 1: Student_data (9 columns)
//   Tab 2: Submissions (22 columns)
//   Tab 3: Faculty (8 columns)

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(colIdx: number): string {
  let letter = '';
  let temp = colIdx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function buildWorksheetXml(rows: string[][]): string {
  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 1);
  let colsXml = '<cols>';
  for (let c = 1; c <= maxCols; c++) {
    colsXml += `<col min="${c}" max="${c}" width="22" customWidth="1"/>`;
  }
  colsXml += '</cols>';

  let sheetDataXml = '<sheetData>';
  rows.forEach((row, rIdx) => {
    const rowNum = rIdx + 1;
    const isHeader = rIdx === 0;
    sheetDataXml += `<row r="${rowNum}"${isHeader ? ' ht="24" customHeight="1"' : ''}>`;
    row.forEach((cellVal, cIdx) => {
      const ref = `${colLetter(cIdx)}${rowNum}`;
      const styleIdx = isHeader ? '1' : '0';
      sheetDataXml += `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t>${escapeXml(cellVal)}</t></is></c>`;
    });
    sheetDataXml += '</row>';
  });
  sheetDataXml += '</sheetData>';

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    colsXml +
    sheetDataXml +
    `</worksheet>`
  );
}

// Standard CRC-32 implementation for ZIP archive packaging
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createZipArchive(files: { name: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const encodedFiles = files.map((f) => ({
    nameBytes: encoder.encode(f.name),
    dataBytes: encoder.encode(f.content),
  }));

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of encodedFiles) {
    const crc = crc32(file.dataBytes);
    const size = file.dataBytes.length;
    const nameLen = file.nameBytes.length;

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameLen);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression (0 = store)
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0x5821, true); // mod date
    lv.setUint32(14, crc, true); // crc32
    lv.setUint32(18, size, true); // compressed size
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, nameLen, true); // file name length
    lv.setUint16(28, 0, true); // extra field length
    localHeader.set(file.nameBytes, 30);

    localParts.push(localHeader, file.dataBytes);

    // Central directory file header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameLen);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true); // flags
    cv.setUint16(10, 0, true); // compression (0 = store)
    cv.setUint16(12, 0, true); // mod time
    cv.setUint16(14, 0x5821, true); // mod date
    cv.setUint32(16, crc, true); // crc32
    cv.setUint32(20, size, true); // compressed size
    cv.setUint32(24, size, true); // uncompressed size
    cv.setUint16(28, nameLen, true); // file name length
    cv.setUint16(30, 0, true); // extra field length
    cv.setUint16(32, 0, true); // comment length
    cv.setUint16(34, 0, true); // disk number
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // relative offset
    centralHeader.set(file.nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralDirSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(4, 0, true); // disk number
  ev.setUint16(6, 0, true); // central dir start disk
  ev.setUint16(8, encodedFiles.length, true); // entries on disk
  ev.setUint16(10, encodedFiles.length, true); // total entries
  ev.setUint32(12, centralDirSize, true); // central dir size
  ev.setUint32(16, offset, true); // central dir offset
  ev.setUint16(20, 0, true); // comment length

  const totalSize = offset + centralDirSize + 22;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of localParts) {
    out.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    out.set(part, pos);
    pos += part.length;
  }
  out.set(eocd, pos);
  return out;
}

export const MASTER_SCHEMA_TABS = {
  Student_data: [
    [
      'REGISTER NUMBER',
      'NAME',
      'FATHER NAME',
      'GENDER',
      'DATE OF BIRTH',
      'NATIONALITY',
      'YEAR',
      'BRANCH',
      'SPECIALIZATION',
    ],
    [
      '20134001',
      'ARUN KUMAR S',
      'SUNDARAM K',
      'MALE',
      '2003-05-14',
      'INDIAN',
      'IV',
      'COMPUTER SCIENCE AND ENGINEERING',
      'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE',
    ],
    [
      '20134002',
      'PRIYA DHARSHINI R',
      'RAJESH M',
      'FEMALE',
      '2003-08-22',
      'INDIAN',
      'IV',
      'AERONAUTICAL ENGINEERING',
      'AVIONICS',
    ],
    [
      '21223001',
      'KARTHICK RAJA V',
      'VELMURUGAN P',
      'MALE',
      '2004-01-19',
      'INDIAN',
      'III',
      'BCA',
      'CLOUD COMPUTING AND CYBER SECURITY',
    ],
  ],
  Submissions: [
    [
      'Submission_ID',
      'Student_Email',
      'Register_Number',
      'Student_Name',
      'Father_Name',
      'Gender',
      'DOB',
      'Nationality',
      'Department_Branch',
      'Specialization',
      'Semester',
      'Section',
      'Batch',
      'Photo_Upload',
      'Final_Drive_URL',
      'Proof_10th_URL',
      'Proof_TC_URL',
      'Validation_Notes',
      'Approval_Status',
      'Teacher_Remarks',
      'HOD_Remarks',
      'Dean_Remarks',
    ],
    [
      'sub-sample01',
      '20134001@student.hindustanuniv.ac.in',
      '20134001',
      'ARUN KUMAR S',
      'SUNDARAM K',
      'MALE',
      '2003-05-14',
      'INDIAN',
      'COMPUTER SCIENCE AND ENGINEERING',
      'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE',
      'VIII',
      'A',
      'Batch A',
      '20134001.jpg',
      'https://drive.google.com/drive/folders/1w3hVMlTQNVUh7Bpru_cwlEJ6TQ77kfqI',
      '',
      '',
      'Verified profile details without edits.',
      'PENDING_TEACHER',
      '',
      '',
      '',
    ],
  ],
  Faculty: [
    [
      'Email',
      'Name',
      'Role',
      'Department',
      'Specialization',
      'Semester',
      'Batch',
      'Section',
    ],
    [
      'hod.cse@hindustanuniv.ac.in',
      'Dr. R. Venkatesh',
      'HOD',
      'COMPUTER SCIENCE AND ENGINEERING',
      'ALL',
      'ALL',
      'ALL',
      'ALL',
    ],
    [
      'teacher.cse@hindustanuniv.ac.in',
      'Prof. M.Kavitha',
      'TEACHER',
      'COMPUTER SCIENCE AND ENGINEERING',
      'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE',
      'VIII',
      'Batch A',
      'A',
    ],
    [
      'hod.aero@hindustanuniv.ac.in',
      'Dr. K. Ramesh',
      'HOD',
      'AERONAUTICAL ENGINEERING',
      'ALL',
      'ALL',
      'ALL',
      'ALL',
    ],
    [
      'teacher.aero@hindustanuniv.ac.in',
      'Prof. S. Anita',
      'TEACHER',
      'AERONAUTICAL ENGINEERING',
      'AVIONICS',
      'VIII',
      'Batch A',
      'A',
    ],
  ],
};

export function generateMasterXlsxBytes(): Uint8Array {
  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>`;

  const rootRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    `<sheet name="Student_data" sheetId="1" r:id="rId1"/>` +
    `<sheet name="Submissions" sheetId="2" r:id="rId2"/>` +
    `<sheet name="Faculty" sheetId="3" r:id="rId3"/>` +
    `</sheets>` +
    `</workbook>`;

  const workbookRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>` +
    `<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="2">` +
    `<font><sz val="11"/><color rgb="FF1E293B"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
    `</fonts>` +
    `<fills count="3">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FF4C1D95"/><bgColor indexed="64"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="2">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
    `</cellXfs>` +
    `</styleSheet>`;

  return createZipArchive([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', content: buildWorksheetXml(MASTER_SCHEMA_TABS.Student_data) },
    { name: 'xl/worksheets/sheet2.xml', content: buildWorksheetXml(MASTER_SCHEMA_TABS.Submissions) },
    { name: 'xl/worksheets/sheet3.xml', content: buildWorksheetXml(MASTER_SCHEMA_TABS.Faculty) },
  ]);
}

export function downloadMasterExcelTemplate() {
  const bytes = generateMasterXlsxBytes();
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'DegreeFrame_Master_Sheet_Template.xlsx');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
