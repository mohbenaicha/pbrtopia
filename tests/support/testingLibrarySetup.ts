import { configure } from '@testing-library/dom';

// App tooltips R2: a tooltip's words also sit in a hidden description node for assistive technology; text queries read what the page shows, so they skip it.
configure({ defaultIgnore: 'script, style, .ui-tooltip__description' });
