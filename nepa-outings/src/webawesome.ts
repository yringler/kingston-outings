/**
 * Registers the Web Awesome custom elements used across the app.
 * Importing each component for its side effects defines its `<wa-*>` tag.
 * The matching theme/utility styles are loaded via angular.json.
 */
import { setIconPath } from '@awesome.me/webawesome/dist/webawesome.js';

// Self-host icons instead of the Font Awesome CDN: angular.json copies the
// Font Awesome Free SVGs (solid/regular/brands) to /fa-icons, and the icon
// resolver fetches `${iconPath}/${folder}/${name}.svg` from there.
setIconPath('/fa-icons');

import '@awesome.me/webawesome/dist/components/badge/badge.js';
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/callout/callout.js';
import '@awesome.me/webawesome/dist/components/card/card.js';
import '@awesome.me/webawesome/dist/components/drawer/drawer.js';
import '@awesome.me/webawesome/dist/components/icon/icon.js';
import '@awesome.me/webawesome/dist/components/input/input.js';
import '@awesome.me/webawesome/dist/components/radio/radio.js';
import '@awesome.me/webawesome/dist/components/radio-group/radio-group.js';
import '@awesome.me/webawesome/dist/components/slider/slider.js';
import '@awesome.me/webawesome/dist/components/copy-button/copy-button.js';
