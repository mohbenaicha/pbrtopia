/**
 * Export R17-R19: the Maya import script, shipped as `import_material.py`. Fixed text like the Blender one. Attribute names that
 * research/export-verify.md could not confirm (aiNormalMap invertY, the displacement zero level through a plusMinusAverage) are set inside
 * try blocks that print a line when Maya refuses them, so one wrong name never stops the rest of the material from being built.
 */
export const MAYA_SCRIPT = `# Builds one Arnold material from the maps next to this file. Run it in Maya's Script Editor (Python tab) or with mayapy.
import json
import os
import re

import maya.cmds as cmds

SIDECAR = "material.json"
PLACE_LINKS = [
    "coverage", "translateFrame", "rotateFrame", "mirrorU", "mirrorV", "stagger", "wrapU", "wrapV", "repeatUV",
    "offset", "rotateUV", "noiseUV", "vertexUvOne", "vertexUvTwo", "vertexUvThree", "vertexCameraOne",
]


def script_folder():
    if "__file__" in globals():
        return os.path.dirname(os.path.abspath(__file__))
    try:
        chosen = cmds.fileDialog2(fileMode=3, caption="Choose the folder that holds " + SIDECAR)
    except Exception:
        chosen = None
    if chosen:
        return chosen[0]
    return os.getcwd()


def require_arnold():
    try:
        if not cmds.pluginInfo("mtoa", query=True, loaded=True):
            cmds.loadPlugin("mtoa", quiet=True)
    except Exception:
        pass
    try:
        loaded = cmds.pluginInfo("mtoa", query=True, loaded=True)
    except Exception:
        loaded = False
    if not loaded:
        raise RuntimeError("Arnold (the mtoa plug-in) could not be loaded, so this material cannot be built. Install or enable MtoA and run the script again.")


def node_name(text):
    cleaned = re.sub(r"[^A-Za-z0-9_]", "_", text) or "material"
    return "_" + cleaned if cleaned[0].isdigit() else cleaned


def try_set(attribute, value, what):
    try:
        cmds.setAttr(attribute, value)
    except Exception:
        print("Could not set " + what + " (" + attribute + "); set it by hand if you need it.")


def build():
    folder = script_folder()
    path = os.path.join(folder, SIDECAR)
    if not os.path.isfile(path):
        raise RuntimeError(SIDECAR + " was not found. Expected at: " + path)
    with open(path, "r", encoding="utf-8") as handle:
        info = json.load(handle)
    require_arnold()

    files = info["files"]
    tiling = info["tiling"]
    base = node_name(info["name"])
    shader = cmds.shadingNode("aiStandardSurface", asShader=True, name=base)
    group = cmds.sets(renderable=True, noSurfaceShader=True, empty=True, name=shader + "SG")
    cmds.connectAttr(shader + ".outColor", group + ".surfaceShader", force=True)

    def file_node(kind):
        name = files.get(kind)
        if name is None:
            return None
        image_path = os.path.join(folder, name)
        if not os.path.isfile(image_path):
            print("Skipped " + kind + ": " + image_path + " is missing.")
            return None
        texture = cmds.shadingNode("file", asTexture=True, isColorManaged=True, name=base + "_" + kind + "_file")
        place = cmds.shadingNode("place2dTexture", asUtility=True, name=base + "_" + kind + "_place")
        cmds.connectAttr(place + ".outUV", texture + ".uvCoord", force=True)
        cmds.connectAttr(place + ".outUvFilterSize", texture + ".uvFilterSize", force=True)
        for attribute in PLACE_LINKS:
            cmds.connectAttr(place + "." + attribute, texture + "." + attribute, force=True)
        cmds.setAttr(place + ".repeatU", tiling["x"])
        cmds.setAttr(place + ".repeatV", tiling["y"])
        cmds.setAttr(texture + ".fileTextureName", image_path, type="string")
        try:
            cmds.setAttr(texture + ".colorSpace", "sRGB" if kind == "albedo" else "Raw", type="string")
            cmds.setAttr(texture + ".ignoreColorSpaceFileRules", 1)
        except Exception:
            print("Could not set the colour space of " + kind + "; set it by hand (sRGB for albedo, Raw for the others).")
        return texture

    albedo = file_node("albedo")
    normal = file_node("normal")
    height = file_node("height")
    roughness = file_node("roughness")
    metallic = file_node("metallic")
    occlusion = file_node("ao")
    packed = file_node("orm")

    connected = []

    # Packed maps carry occlusion in red, roughness in green and metallic in blue; separate files are grey, so red stands for the value.
    occlusion_node = occlusion if occlusion is not None else packed
    occlusion_source = occlusion_node + ".outColorR" if occlusion_node is not None else None
    if albedo is not None and occlusion_source is not None:
        multiply = cmds.shadingNode("aiMultiply", asUtility=True, name=base + "_albedo_x_ao")
        cmds.connectAttr(albedo + ".outColor", multiply + ".input1", force=True)
        for channel in ("R", "G", "B"):
            cmds.connectAttr(occlusion_source, multiply + ".input2" + channel, force=True)
        cmds.connectAttr(multiply + ".outColor", shader + ".baseColor", force=True)
        connected.append("albedo x ambient occlusion -> baseColor")
    elif albedo is not None:
        cmds.connectAttr(albedo + ".outColor", shader + ".baseColor", force=True)
        connected.append("albedo -> baseColor")

    if roughness is not None:
        cmds.connectAttr(roughness + ".outColorR", shader + ".specularRoughness", force=True)
        connected.append("roughness -> specularRoughness")
    elif packed is not None:
        cmds.connectAttr(packed + ".outColorG", shader + ".specularRoughness", force=True)
        connected.append("packed green -> specularRoughness")

    if metallic is not None:
        cmds.connectAttr(metallic + ".outColorR", shader + ".metalness", force=True)
        connected.append("metallic -> metalness")
    elif packed is not None:
        cmds.connectAttr(packed + ".outColorB", shader + ".metalness", force=True)
        connected.append("packed blue -> metalness")

    if normal is not None:
        normal_map = cmds.shadingNode("aiNormalMap", asUtility=True, name=base + "_normal_map")
        cmds.connectAttr(normal + ".outColor", normal_map + ".input", force=True)
        cmds.connectAttr(normal_map + ".outValue", shader + ".normalCamera", force=True)
        if info["normalConvention"] == "directx":
            try_set(normal_map + ".invertY", True, "the aiNormalMap Y inversion")
        connected.append("normal -> normalCamera")

    if height is not None:
        displacement = cmds.shadingNode("displacementShader", asShader=True, name=base + "_displacement")
        try_set(displacement + ".scale", info["heightScale"], "the displacement scale")
        offset = cmds.shadingNode("plusMinusAverage", asUtility=True, name=base + "_zero_level")
        cmds.connectAttr(height + ".outColorR", offset + ".input1D[0]", force=True)
        try_set(offset + ".input1D[1]", -info["heightMidlevel"], "the displacement zero level")
        cmds.connectAttr(offset + ".output1D", displacement + ".displacement", force=True)
        cmds.connectAttr(displacement + ".displacement", group + ".displacementShader", force=True)
        connected.append("height (zero level " + str(info["heightMidlevel"]) + ") -> displacement")

    print("Material " + shader + " built:")
    for line in connected:
        print("  " + line)
    return shader


build()
`;
