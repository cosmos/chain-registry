from colorthief import ColorThief

import pathlib
import json


chain_registry = pathlib.Path(".")


def get_primary_color(png):
    color_thief = ColorThief(png)

    dominant_color = color_thief.get_color(quality=1)

    return "#%02x%02x%02x" % dominant_color


def add_primary_color_to_image(image):
    if "png" not in image.keys():
        return

    if "theme" in image.keys() and "primary_color_hex" in image["theme"].keys():
        return

    png = image["png"]
    png = png.replace(
        "https://raw.githubusercontent.com/cosmos/chain-registry/master",
        ".",
    )

    try:
        hex = get_primary_color(png)
    except:
        return

    image.setdefault("theme", {})["primary_color_hex"] = hex

    print(image["theme"]["primary_color_hex"])

    return image


for item in chain_registry.rglob("*"):
    if (
        item.is_file()
        and ("assetlist.json" in item.name or "chain.json" in item.name)
        and "_template" not in item.parts
        and "_IBC" not in item.parts
        and "testnets" not in item.parts
    ):
        with open(item, "r+", encoding="utf-8") as f:
            data = json.load(f)

            if "images" in data.keys():
                for image in data["images"]:
                    new_image = add_primary_color_to_image(image)
                    if new_image:
                        image = new_image

            if "assets" in data.keys():
                for asset in data["assets"]:

                    print(asset["symbol"])

                    if "images" in asset.keys():
                        for image in asset["images"]:
                            new_image = add_primary_color_to_image(image)
                            if new_image:
                                image = new_image

            print(data)
            item.write_text(json.dumps(data, indent=2, ensure_ascii=False))
