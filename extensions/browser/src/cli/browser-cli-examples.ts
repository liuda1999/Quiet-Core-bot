/**
 * Help examples shown by the Browser CLI root command.
 */
/** Core Browser CLI examples for lifecycle and inspection commands. */
export const browserCoreExamples = [
  "quiet-core-bot browser status",
  "quiet-core-bot browser start",
  "quiet-core-bot browser start --headless",
  "quiet-core-bot browser stop",
  "quiet-core-bot browser tabs",
  "quiet-core-bot browser open https://example.com",
  "quiet-core-bot browser focus abcd1234",
  "quiet-core-bot browser close abcd1234",
  "quiet-core-bot browser screenshot",
  "quiet-core-bot browser screenshot --full-page",
  "quiet-core-bot browser screenshot --ref 12",
  "quiet-core-bot browser snapshot",
  "quiet-core-bot browser snapshot --format aria --limit 200",
  "quiet-core-bot browser snapshot --efficient",
  "quiet-core-bot browser snapshot --labels",
];

/** Browser CLI examples for interaction/action commands. */
export const browserActionExamples = [
  "quiet-core-bot browser navigate https://example.com",
  "quiet-core-bot browser resize 1280 720",
  "quiet-core-bot browser click 12 --double",
  "quiet-core-bot browser click-coords 120 340",
  'quiet-core-bot browser type 23 "hello" --submit',
  "quiet-core-bot browser press Enter",
  "quiet-core-bot browser hover 44",
  "quiet-core-bot browser drag 10 11",
  "quiet-core-bot browser select 9 OptionA OptionB",
  "quiet-core-bot browser upload /tmp/quiet-core-bot/uploads/file.pdf",
  "quiet-core-bot browser upload media://inbound/file.pdf",
  'quiet-core-bot browser fill --fields \'[{"ref":"1","value":"Ada"}]\'',
  "quiet-core-bot browser dialog --accept",
  'quiet-core-bot browser wait --text "Done"',
  "quiet-core-bot browser evaluate --fn '(el) => el.textContent' --ref 7",
  "quiet-core-bot browser evaluate --fn 'const title = document.title; return title;'",
  "quiet-core-bot browser console --level error",
  "quiet-core-bot browser pdf",
];
