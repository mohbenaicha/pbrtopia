import { createContext } from 'react';
import { createPaintBridge, type PaintBridge } from '@mat/preview';

/** Compositing R1, R3: how the painting tool in the Maps section reaches the preview (its scene, its mesh, its mesh picker). Without a provider there is no preview behind it. */
export const PaintBridgeContext = createContext<PaintBridge>(createPaintBridge());
