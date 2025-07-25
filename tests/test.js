import { r } from "../src/Solarite.js";
let button = r({
  count: 0,
  inc() {
    this.count++;
    this.render();
  },
  render() {
    r(this, r("button", { onclick: this.inc }, this.count, " times.",
    r("span", { contenteditable: true }, "a")));
  }
});
document.body.append(button);
