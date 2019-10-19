import { expect } from 'chai';
import { getS3PutObjectInputForKey, getFinalS3Key } from '../lib/cache-s3';

describe("getFinalS3Key", () => {
  it("does nothing to non-brotli files", () => {
    expect(getFinalS3Key('blarg.html')).to.equal('blarg.html');
  });

  it("swaps the extension order of brotli files", () => {
    expect(getFinalS3Key('blarg.html.br')).to.equal('blarg.br.html');
  });
});

describe("getS3PutObjectInputForKey()", () => {
  it("raises exception when content type can't be determined", () => {
    expect(() => getS3PutObjectInputForKey('blarg'))
      .throws('Unable to determine content type for blarg!');
    expect(() => getS3PutObjectInputForKey('blarg.zoof'))
      .throws('Unable to determine content type for blarg.zoof!');
  });

  it("works with PDF files", () => {
    expect(getS3PutObjectInputForKey('blarg.pdf')).to.deep.equal({
      ContentType: 'application/pdf',
      Key: 'blarg.pdf'
    });
  });

  it("works with text files", () => {
    expect(getS3PutObjectInputForKey('blarg.txt')).to.deep.equal({
      ContentType: 'text/plain; charset=utf-8',
      Key: 'blarg.txt'
    });
  });

  it("works with brotli files", () => {
    expect(getS3PutObjectInputForKey('blarg.html.br')).to.deep.equal({
      ContentType: 'text/html; charset=utf-8',
      ContentEncoding: 'br',
      Key: 'blarg.br.html'
    });
  });
});
