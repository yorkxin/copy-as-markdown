export default class MarkdownResponse {
  constructor({ markdown = "", size = 1 }) {
    this.markdown = markdown;
    this.size = size;
  }
}
