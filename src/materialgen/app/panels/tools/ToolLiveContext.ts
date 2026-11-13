import { createContext } from 'react';
import { createToolLiveFeed, type ToolLiveFeed } from '@mat/preview';

/** Imageops R75: where a tool panel sends the ticks of a dragged setting, past the project view's state. Without a provider the feed has no viewport behind it. */
export const ToolLiveContext = createContext<ToolLiveFeed>(createToolLiveFeed());
