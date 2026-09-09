import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compressTestPhoto } from './test-photo';

test('rejects unsupported and oversized photos before decoding', async () => {
  await assert.rejects(compressTestPhoto({ type: 'text/plain', size: 10 } as File), /JPEG/);
  await assert.rejects(compressTestPhoto({ type: 'image/jpeg', size: 11 * 1024 * 1024 } as File), /10 MB/);
});

test('resizes photos within both bounds and releases temporary URLs, including decode failures', async () => {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let dimensions = [1200, 1100];
  let fail = false;
  let revoked = 0;
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
    toDataURL: (format: string, quality: number) => {
      assert.equal(format, 'image/jpeg');
      assert.equal(quality, 0.7);
      return 'data:image/jpeg;base64,YQ==';
    },
  };
  try {
    globalThis.Image = class {
      naturalWidth = dimensions[0];
      naturalHeight = dimensions[1];
      onload = () => {};
      onerror = () => {};
      set src(_: string) { queueMicrotask(() => fail ? this.onerror() : this.onload()); }
    } as unknown as typeof Image;
    globalThis.document = { createElement: () => canvas } as unknown as Document;
    URL.createObjectURL = () => 'blob:photo';
    URL.revokeObjectURL = () => { revoked++; };
    const file = { type: 'image/jpeg', size: 100 } as File;
    assert.equal(await compressTestPhoto(file), 'data:image/jpeg;base64,YQ==');
    assert.equal(canvas.width, 655);
    assert.equal(canvas.height, 600);
    dimensions = [400, 300];
    await compressTestPhoto(file);
    assert.equal(canvas.width, 400);
    assert.equal(canvas.height, 300);
    fail = true;
    await assert.rejects(compressTestPhoto(file), /could not be read/);
    assert.equal(revoked, 3);
  } finally {
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
