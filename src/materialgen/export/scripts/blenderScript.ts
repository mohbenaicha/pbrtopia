/**
 * Export R14-R16, R19: the Blender import script, shipped as `build_material.py`. Fixed text: the only values it uses come from `material.json`
 * at run time, so nothing about the project is ever written into the source. Compiles on Python 3.7 and later (Blender 2.8 and later); the Mix
 * node is used when the running Blender has it (3.4 and later), the older MixRGB node otherwise (VERIFY(1), research/export-verify.md).
 */
export const BLENDER_SCRIPT = `# Builds one new material from the maps next to this file. Run it in Blender's Scripting tab or with: blender --python build_material.py
import json
import os

import bpy

SIDECAR = "material.json"


def script_folder():
    # The first folder that holds the sidecar. Inside Blender's Text editor __file__ is not the file's place on disk, so the text's own path comes first.
    candidates = []
    text = getattr(bpy.context.space_data, "text", None)
    if text is not None and text.filepath:
        candidates.append(os.path.dirname(bpy.path.abspath(text.filepath)))
    if "__file__" in globals():
        candidates.append(os.path.dirname(os.path.abspath(__file__)))
    if bpy.data.filepath:
        candidates.append(os.path.dirname(bpy.data.filepath))
    candidates.append(os.getcwd())
    for folder in candidates:
        if os.path.isfile(os.path.join(folder, SIDECAR)):
            return folder
    return candidates[0]


def new_node(tree, kind, column, row):
    node = tree.nodes.new(kind)
    node.location = (column * 300, -row * 280)
    return node


def new_mix_multiply(tree, column, row):
    # Returns (node, inputs for A and B, output) for whichever Mix node this Blender has.
    try:
        node = new_node(tree, "ShaderNodeMix", column, row)
        node.data_type = "RGBA"
        node.blend_type = "MULTIPLY"
        node.inputs[0].default_value = 1.0
        return node, (node.inputs[6], node.inputs[7]), node.outputs[2]
    except RuntimeError:
        node = new_node(tree, "ShaderNodeMixRGB", column, row)
        node.blend_type = "MULTIPLY"
        node.inputs[0].default_value = 1.0
        return node, (node.inputs[1], node.inputs[2]), node.outputs[0]


def new_separate(tree, column, row):
    try:
        return new_node(tree, "ShaderNodeSeparateColor", column, row)
    except RuntimeError:
        return new_node(tree, "ShaderNodeSeparateRGB", column, row)


def build():
    folder = script_folder()
    path = os.path.join(folder, SIDECAR)
    if not os.path.isfile(path):
        raise RuntimeError(SIDECAR + " was not found. Expected at: " + path)
    with open(path, "r", encoding="utf-8") as handle:
        info = json.load(handle)

    files = info["files"]
    spaces = info["colorSpaces"]
    tiling = info["tiling"]
    if info["normalConvention"] != "opengl":
        print("Warning: these normals are DirectX (green down). Blender expects OpenGL, so the surface may look inverted.")

    material = bpy.data.materials.new(info["name"])
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()

    output = new_node(tree, "ShaderNodeOutputMaterial", 5, 0)
    shader = new_node(tree, "ShaderNodeBsdfPrincipled", 4, 0)
    tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])

    coordinates = new_node(tree, "ShaderNodeTexCoord", 0, 1)
    mapping = new_node(tree, "ShaderNodeMapping", 1, 1)
    mapping.inputs["Scale"].default_value = (tiling["x"], tiling["y"], 1.0)
    tree.links.new(coordinates.outputs["UV"], mapping.inputs["Vector"])

    row = {"value": 0}

    def image_node(kind):
        name = files.get(kind)
        if name is None:
            return None
        image_path = os.path.join(folder, name)
        if not os.path.isfile(image_path):
            print("Skipped " + kind + ": " + image_path + " is missing.")
            return None
        image = bpy.data.images.load(image_path, check_existing=False)
        image.colorspace_settings.name = spaces.get(kind, "sRGB" if kind == "albedo" else "Non-Color")
        node = new_node(tree, "ShaderNodeTexImage", 2, row["value"])
        row["value"] += 1
        node.image = image
        node.label = kind
        tree.links.new(mapping.outputs["Vector"], node.inputs["Vector"])
        return node

    albedo = image_node("albedo")
    normal = image_node("normal")
    height = image_node("height")
    roughness = image_node("roughness")
    metallic = image_node("metallic")
    occlusion = image_node("ao")
    packed = image_node("orm")
    split = None
    if packed is not None:
        split = new_separate(tree, 3, row["value"])
        tree.links.new(packed.outputs["Color"], split.inputs[0])

    connected = []

    # Base colour, multiplied by occlusion when the material has it (its own map or the red channel of the packed map).
    occlusion_output = None
    if occlusion is not None:
        occlusion_output = occlusion.outputs["Color"]
    elif split is not None:
        occlusion_output = split.outputs[0]
    if albedo is not None and occlusion_output is not None:
        _, (first, second), result = new_mix_multiply(tree, 3, 0)
        tree.links.new(albedo.outputs["Color"], first)
        tree.links.new(occlusion_output, second)
        tree.links.new(result, shader.inputs["Base Color"])
        connected.append("albedo x ambient occlusion -> Base Color")
    elif albedo is not None:
        tree.links.new(albedo.outputs["Color"], shader.inputs["Base Color"])
        connected.append("albedo -> Base Color")

    if roughness is not None:
        tree.links.new(roughness.outputs["Color"], shader.inputs["Roughness"])
        connected.append("roughness -> Roughness")
    elif split is not None:
        tree.links.new(split.outputs[1], shader.inputs["Roughness"])
        connected.append("packed green -> Roughness")

    if metallic is not None:
        tree.links.new(metallic.outputs["Color"], shader.inputs["Metallic"])
        connected.append("metallic -> Metallic")
    elif split is not None:
        tree.links.new(split.outputs[2], shader.inputs["Metallic"])
        connected.append("packed blue -> Metallic")

    if normal is not None:
        normal_map = new_node(tree, "ShaderNodeNormalMap", 3, 2)
        normal_map.space = "TANGENT_SPACE"
        normal_map.inputs["Strength"].default_value = 1.0
        tree.links.new(normal.outputs["Color"], normal_map.inputs["Color"])
        tree.links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
        connected.append("normal -> Normal")

    if height is not None:
        displacement = new_node(tree, "ShaderNodeDisplacement", 4, 2)
        displacement.inputs["Scale"].default_value = info["heightScale"]
        displacement.inputs["Midlevel"].default_value = info["heightMidlevel"]
        tree.links.new(height.outputs["Color"], displacement.inputs["Height"])
        tree.links.new(displacement.outputs["Displacement"], output.inputs["Displacement"])
        if hasattr(material, "displacement_method"):
            material.displacement_method = "BOTH"
        elif hasattr(material, "cycles"):
            material.cycles.displacement_method = "BOTH"
        connected.append("height -> Displacement")

    print("Material " + material.name + " built:")
    for line in connected:
        print("  " + line)
    return material


build()
`;
