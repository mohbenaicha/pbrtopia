This file holds every word of the tutorial. Edit it freely.

How it works:
- A line "## step.id | Heading" starts a step. Do not change the step id (the part before the bar); change the heading and the text under it.
- A blank line starts a new paragraph.
- **bold** and *italic* work. Use bold for the names of buttons and panels.
- Anything above the first "##" line (like this note) is ignored.
- Every step in the tour needs an entry here, and every entry needs a step (a test checks it).

## generate.prompt | Prompt
Describe the material you want, like *weathered copper with green patina*.

## generate.ideas | Ideas
If you're out of words, **Ideas** suggests prompts you can click to use.

## generate.references | Reference images
Add one or more images to steer the final look.

## generate.color | Albedo or diffuse
Choose the colour map type. **Albedo** is pure surface colour; **Diffuse** keeps diffused lighting. Pick albedo for most PBR work. These work on a best effort basis, so there is no guarantee the vision models will generate a pure albedo or pure diffuse texture.

## generate.size | Size
The size of every map in the material, in pixels. The default aspect ratio is 1:1. This app is only built to support 1:1 aspect ratios during authoring.

## generate.model | Model settings
Pick the generation model. This will show which model, resolution and quality level per texture map to be generated. Texture maps that are generated in a single image are lumped under a single toggle.

## generate.button | Generate and Custom setup
**Generate** kicks off the generation process, where an progress status below it appears. **Custom setup** (the icon beside it) lets you choose exactly which maps to make and how they are grouped into images.

## generate.summary | Summary
A short summary of the generaiton plan: what the next run will make and with which models. It also updates with the details of the run after it is finished.

## generate.log | Run log
Every run of this session is listed here, with what was made and any problems. This does not persist into the next session - ex: when you close this project and reopen it.

## maps.tools | Editing tools
These controls edit all the texture maps, mostly together. **Crop** trims off edges, **Mirror** mirrors quadrants or halves, **Swap diagonals** helps preview seemless tiles, **Blend edges** critical for hides seams, especially with canny edge detection, and **Paint** being the most elaborate allows you to stamp on and clone parts of the texture.

## maps.cards | Map previews
Colour, height, normal, roughness, metal and occlusion. They form the canonical texture set for your material.

## maps.card-actions | Texture map actions
Hover over a texture map now to view what actions are available: click on it directly to enlarge the preview, edit allows you to apply filters per map, restore allows you to restore the original generated copy. A banner on a card means it is out of date with the maps it came from.

## maps.occlusion | Occlusion
Occlusion is procedurally generated from the height map if you opted to generate one.

## viewport.open | Viewport settings
Here you can edit environment and material settings. These settings only change the preview, not your actual texture maps.

## viewport.environment | Environment
Control lighting intensity and hdri image to preview the material in different lighting environments.

## viewport.material | Material preview
Adjust the preview of the material itself, like how strong the bumps look. Use it to judge the maps under different lighting.

## viewport.preview-only | Preview only
These settings change the preview only. They never change your texture maps or an exported material.

## masks.open | Material masks
This button pulls up material masks editing after a *metal-roughness* image has been generated.

## masks.swatches | Swatches
Each swatch (color card) is one kind of material in the picture, like rust or paint or gravel. Hover a swatch to highlight that material on the model, and click it to activate it. One or more can be active at once to edit multiple materials at once.

## masks.properties | Material properties
Once a swatch is active, its settings expand here. **Roughness**, **Metalness** and **Height** adjust that material, and the arrow beside each slider resets it to the base material. **Colour mixin** shapes roughness and metalness by the albedo inside the material. **Reset all** puts every material back to its defaults and **Re-run decomposition** makes the masks again.

## shading.control | Preview shading
Switch between viewing a single map, like **Albedo** or **Normal**, and the full lit **PBR** preview.

## topbar.actions | Top bar
**Projects** goes back to your projects, **Export** saves the material, **Tutorial** replays this tour, and **Settings** opens the settings.

## export.types | Export for
Here, you can select how to export your material. Don't forget to download the add-ons to import these into Blender or Maya. Substance-targetted exports are named in a Substance compatible naming and so dont' need an add-on.

## export.packing | Packing
Maps can be saved as separate files, or packed so *occlusion, roughness and metal* as RGB (ORM).

## export.parts | What is included
Choose which extra maps to include, you can additionally export an emission map from the material masks if you generated them.

## export.size | Size
The size of the exported files. Sizes larger than the material are scaled up from what you have.

## projects.new | New project
Create a new project to generate a new material.

## projects.import | Import project
Opens a project saved as a zip file.

## projects.settings | Settings
The same settings as in a project: API keys, models and storage.

## projects.card | Project cards
Opens, renames, exports , or deletes a project. **NOTE:** Delete cannot be undone.

## settings.keys | API keys
Add the API keys for the image and text models. Keys are encrypted with your password, stay on this device, and are sent only to the provider you generate with.

## settings.env | Read from environment
**Only available in the exe and local web builds, not on pbrtopia.com.** Instead of pasting a key, turn on **Read keys from environment** and type the name of a Windows environment variable. The key is read each time it is used and never stored by the app.

## settings.models | Models
Choose the **prompt enhancer** model that augments your prompt with albedo/diffuse descriptions and describes the material for the material mask to be generated. The prompt enhancer uses the generated albedo/diffuse maps , describes it and feed the prompt to generate material masks. For that purpose you can define the resolution at which to send the albedo/diffuse texture to save on tokens. The same can be done when initially generating a albedo/diffuse map based ona reference.

## settings.storage | Storage
**Delete all media** frees space by removing the generated images. Keep my data attempts to request from the browser that it prioritize your projects to be preserved when the browser needs to free its temporary storage to make space on your computer. The request could be rejected by your browser.