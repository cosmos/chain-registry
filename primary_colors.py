from colorthief import ColorThief

import pathlib
import json


chain_registry = pathlib.Path(".")


def get_primary_color(png):
    color_thief = ColorThief(png)

    dominant_color = color_thief.get_color(quality=1)

    return "#%02x%02x%02x" % dominant_color


for item in chain_registry.rglob("*"):
    if (
        item.is_file()
        and "assetlist.json" in item.name
        and "_template" not in item.parts
        and "testnets" not in item.parts
    ):
        with open(item, "r+", encoding="utf-8") as f:
            data = json.load(f)
            for asset in data["assets"]:

                print(asset["symbol"])

                if "images" not in asset.keys():
                    continue

                for i in range(len(asset["images"])):

                    if "png" not in asset["images"][i].keys():
                        continue

                    if (
                        "theme" in asset["images"][i].keys()
                        and "primary_color_hex" in asset["images"][i]["theme"].keys()
                    ):
                        continue

                    png = asset["images"][i]["png"]
                    png = png.replace(
                        "https://raw.githubusercontent.com/cosmos/chain-registry/master",
                        ".",
                    )

                    try:
                        hex = get_primary_color(png)
                    except:
                        continue

                    asset.setdefault("images", [{}])[i].setdefault("theme", {})[
                        "primary_color_hex"
                    ] = hex

                    print(asset["images"][i]["theme"]["primary_color_hex"])

            print(data)
            item.write_text(json.dumps(data, indent=2, ensure_ascii=False))


# https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/wosmo.png
