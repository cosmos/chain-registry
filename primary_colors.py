from colorthief import ColorThief

import pathlib
import json


chain_registry = pathlib.Path(".")


def get_primary_color(png):
    color_thief = ColorThief(png)

    dominant_color = color_thief.get_color(quality=1)

    return "#%02x%02x%02x" % dominant_color


for item in chain_registry.rglob("*"):
    if item.is_file() and "assetlist.json" in item.name:
        with open(item, "r+") as f:
            data = json.load(f)
            for asset in data["assets"]:

                try:
                    print(asset["symbol"])

                    if "images" not in asset.keys():
                        pass

                    for i in range(len(asset["images"])):

                        if "png" not in asset["images"][i].keys():
                            pass

                        if (
                            "theme" in asset["images"][i].keys()
                            and "primary_color_hex"
                            in asset["images"][i]["theme"].keys()
                        ):
                            pass

                        png = asset["images"][i]["png"]
                        png = png.replace(
                            "https://raw.githubusercontent.com/cosmos/chain-registry/master",
                            ".",
                        )

                        hex = get_primary_color(png)

                        asset.setdefault("images", [{}])[i].setdefault("theme", {})[
                            "primary_color_hex"
                        ] = hex

                        print(asset["images"][i]["theme"]["primary_color_hex"])

                except KeyError:
                    pass

            print(data)
            item.write_text(json.dumps(data, indent=2))


# https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/wosmo.png
